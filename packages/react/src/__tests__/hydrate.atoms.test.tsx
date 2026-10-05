/**
 * packages/react/src/__tests__/hydrate.atoms.test.tsx
 *
 * Atom hydration (fn-17 task .3, R3/R4): `hydrate` prop, the snapshot transport and `AtomsSnapshot`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { hydrateRoot, type Root } from 'react-dom/client'
import React, { Suspense } from 'react'
import { renderToString } from 'react-dom/server'
import { Effect, Schema } from 'effect'
import { Atom, type Snapshot } from '@sleekstack/core'
import { AtomsSnapshot, LayerProvider, renderWithAtoms, useAtomRefresh, useAtomSuspense, useAtomValue } from '../index'
import { ProviderContext, QueryStoreContext } from '../context'
import { SnapshotIdContext } from '../LayerProvider'

// Server and client renderers share context objects in one process; see hydrate.test.tsx.
const resetContexts = () => {
  for (const c of [ProviderContext, QueryStoreContext])
    (c as unknown as { _currentValue: unknown })._currentValue = null
  ;(SnapshotIdContext as unknown as { _currentValue: unknown })._currentValue = ''
}
const roots: Root[] = []
afterEach(() => {
  cleanup()
  for (const r of roots.splice(0)) act(() => r.unmount())
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

const setup = () => {
  const runs = { n: 0 }
  const name = Atom.serializable.result(Atom.make(Effect.sync(() => `name${++runs.n}`)), {
    key: 'name',
    schema: Schema.String,
  })
  const count = Atom.serializable(Atom.make(1), { key: 'count', schema: Schema.Number })
  const doubled = Atom.make((get) => get(count) * 2) // not serializable: recomputed from the seeded source
  const fallbacks = { n: 0 }
  const Fallback = () => {
    fallbacks.n++
    return <>loading</>
  }
  const View = () => {
    const refresh = useAtomRefresh(name)
    return (
      <button
        onClick={refresh}
      >{`${useAtomSuspense(name).value}:${useAtomValue(count)}:${useAtomValue(doubled)}`}</button>
    )
  }
  const tree = (props: { hydrate?: Snapshot; snapshotId?: string }, snapshot = true) => (
    <LayerProvider provide={[]} {...props}>
      <Suspense fallback={<Fallback />}>
        <View />
      </Suspense>
      {snapshot && <AtomsSnapshot />}
    </LayerProvider>
  )
  return { runs, fallbacks, tree }
}

const serverHtml = async (node: React.ReactNode) => {
  const html = await renderWithAtoms(node)
  resetContexts()
  return html
}

/** Hydrates `node` over `html`; returns the hydration warnings React logged. */
const hydrate = async (html: string, node: React.ReactNode) => {
  const errors = vi.spyOn(console, 'error')
  const container = document.body.appendChild(document.createElement('div'))
  container.innerHTML = html
  await act(async () => void roots.push(hydrateRoot(container, node)))
  await act(() => new Promise((r) => setTimeout(r, 10)))
  return { container, warnings: errors.mock.calls.filter((c) => /hydrat|did not match/i.test(c.map(String).join(' '))) }
}

describe('atom hydration', () => {
  it.each([
    ['transport', {}, true],
    ['hydrate prop', { hydrate: { name: 'seeded', count: 1 } }, false],
  ] as const)(
    '%s: first client render equals server HTML; the seeded atom runs zero times until refresh',
    async (_, props, snapshot) => {
      const { runs, fallbacks, tree } = setup()
      const html = await serverHtml(tree(props, snapshot))
      const serverRuns = runs.n
      fallbacks.n = 0 // the server renders it while the scope opens
      const { container, warnings } = await hydrate(html, tree(props, snapshot))
      expect(warnings).toEqual([])
      expect(runs.n).toBe(serverRuns)
      expect(fallbacks.n).toBe(0)
      expect(container.querySelector('button')!.textContent).toBe(`${'hydrate' in props ? 'seeded' : 'name1'}:1:2`)
      await act(async () => container.querySelector('button')!.click())
      await waitFor(() => expect(runs.n).toBe(serverRuns + 1))
    },
  )

  it('a decode failure falls back to a normal load', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { runs, tree } = setup()
    render(tree({ hydrate: { name: 42 } }, false))
    expect(await screen.findByText('name1:1:2')).toBeTruthy()
    expect(runs.n).toBe(1)
  })

  it.each(['not json', '[1]', '"s"'])(
    'malformed or non-object transport %s: empty snapshot, dev warning, normal load',
    async (content) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      document.body.innerHTML = `<script type="application/json" data-sleekstack-atoms="">${content}</script>`
      const { runs, tree } = setup()
      render(tree({}, false))
      expect(await screen.findByText('name1:1:2')).toBeTruthy()
      expect(runs.n).toBe(1)
      expect(warn.mock.calls.some((c) => String(c[0]).includes('atom snapshot tag'))).toBe(true)
    },
  )

  it('independently hydrated roots with different snapshotIds each seed their own values', async () => {
    const { runs, tree } = setup()
    const shown = []
    for (const [id, value] of [
      ['a', 5],
      ['b', 6],
    ] as const) {
      const html = await serverHtml(tree({ snapshotId: id, hydrate: { name: `n-${id}`, count: value } }))
      const { container, warnings } = await hydrate(html, tree({ snapshotId: id }))
      expect(warnings).toEqual([])
      expect(container.querySelector(`script[data-sleekstack-atoms="${id}"]`)).not.toBeNull()
      shown.push(container.querySelector('button')!.textContent)
    }
    expect(shown).toEqual(['n-a:5:10', 'n-b:6:12'])
    expect(runs.n).toBe(0)
  })

  it('a provider without snapshotId ignores transport when two unkeyed tags exist', async () => {
    document.body.innerHTML = [1, 2]
      .map((i) => `<script type="application/json" data-sleekstack-atoms="">{"name":"n-${i}"}</script>`)
      .join('')
    const { runs, tree } = setup()
    render(tree({}, false))
    expect(await screen.findByText('name1:1:2')).toBeTruthy()
    expect(runs.n).toBe(1)
  })
})

describe('AtomsSnapshot', () => {
  it('carries the snapshotId; hostile values cannot break out, round-trip, and hydrate without mismatch', async () => {
    const hostile = '</script><script>x()</script><!-- \u2028\u2029 & >'
    const text = Atom.serializable(Atom.make(hostile), { key: 'text', schema: Schema.String })
    const Show = () => <p>{useAtomValue(text)}</p>
    const tree = (
      <LayerProvider provide={[]} snapshotId="main">
        <Suspense fallback="wait">
          <Show />
        </Suspense>
        <AtomsSnapshot />
      </LayerProvider>
    )
    const html = await serverHtml(tree)
    const json = html.slice(html.indexOf('<script'))
    expect(json.match(/<script/g)).toHaveLength(1)
    expect(json).not.toContain('<!--')
    expect(json.includes('\u2028') || json.includes('\u2029')).toBe(false)
    const { container, warnings } = await hydrate(html, tree)
    expect(warnings).toEqual([])
    const tag = container.querySelector('script[data-sleekstack-atoms="main"]')!
    expect(JSON.parse(tag.textContent!)).toEqual({ text: hostile })
    expect(container.querySelector('p')!.textContent).toBe(hostile)
  })

  it('throws the existing error outside a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderToString(<AtomsSnapshot />)).toThrow(/needs a <LayerProvider> above/)
  })
})
