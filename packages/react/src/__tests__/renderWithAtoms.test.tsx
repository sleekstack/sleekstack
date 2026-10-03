// @vitest-environment node
/**
 * packages/react/src/__tests__/renderWithAtoms.test.tsx
 *
 * Server atom reads under the request registry (fn-17 task .2, R2).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import React, { Suspense } from 'react'
import { renderToString, type RenderToPipeableStreamOptions } from 'react-dom/server'
import { Context, Effect, Layer } from 'effect'
import { Atom } from '@sleekstack/core'
import { ADOPT_MS } from '../managedScope'
import { LayerProvider, renderWithAtoms, useAtom, useAtomRefresh, useAtomSet, useAtomSuspense, useAtomValue, useService } from '../index'

const Db = Context.GenericTag<{ name: string }>('SsrDb')
const Other = Context.GenericTag<{ name: string }>('SsrOther')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const stream = (element: React.ReactNode, options: RenderToPipeableStreamOptions = {}) =>
  new Promise<{ html: string; closed: Promise<void> }>((resolve, reject) => {
    let html = ''
    const decoder = new TextDecoder()
    // Minimal Node Writable for Fizz's pipe (no @types/node here); emits 'finish' a tick after end, like a socket.
    const listeners: Record<string, Array<() => void>> = {}
    const sink = {
      write: (chunk: Uint8Array | string) => { html += typeof chunk === 'string' ? chunk : decoder.decode(chunk); return true },
      end: () => {
        resolve({ html, closed: s.closed })
        setTimeout(() => { for (const l of listeners.finish ?? []) l() }, 5)
      },
      on: (event: string, l: () => void) => ((listeners[event] ??= []).push(l), sink),
      destroy: (e: unknown) => reject(e),
    }
    const s = renderWithAtoms(element, {
      stream: { ...options, onAllReady: () => s.pipe(sink as never), onShellError: reject },
    })
  })

afterEach(() => vi.restoreAllMocks())

describe('renderWithAtoms', () => {
  const count = Atom.make(1)
  const data = Atom.make(Effect.succeed('loaded').pipe(Effect.delay('5 millis')))
  const Hooks = () => {
    const v = useAtomValue(count)
    const [n] = useAtom(count)
    useAtomSet(count)
    useAtomRefresh(count)
    return <span>{`${v}-${n}-${useAtomSuspense(data).value}`}</span>
  }

  it('renders all five atom hooks in stream mode', async () => {
    const { html, closed } = await stream(<LayerProvider provide={[]}><Suspense fallback="wait"><Hooks /></Suspense></LayerProvider>)
    expect(html).toContain('1-1-loaded')
    await closed
  })

  it('renders atom hooks in string mode; an unsettled result atom reads Initial', async () => {
    const never = Atom.make(Effect.never)
    const now = Atom.make(Effect.succeed('now'))
    const View = () => {
      const [n] = useAtom(count)
      useAtomSet(count)
      useAtomRefresh(count)
      return <span>{`${useAtomValue(count)}${n}:${useAtomValue(never)._tag}:${useAtomSuspense(now).value}`}</span>
    }
    expect(await renderWithAtoms(<LayerProvider provide={[]}><Suspense fallback="wait"><View /></Suspense></LayerProvider>)).toContain('11:Initial:now')
  })

  const Name = ({ tag }: { tag: typeof Db }) => <b>{useService(tag).name}</b>
  const tree = (outer: Layer.Layer<any>, inner: Layer.Layer<any>) => (
    <LayerProvider provide={[outer, Layer.succeed(Other, { name: 'other' })]}>
      <Suspense fallback="outer-wait">
        <Name tag={Db} />
        <LayerProvider provide={[inner]}>
          <Suspense fallback="inner-wait"><Name tag={Db} /><Name tag={Other} /></Suspense>
        </LayerProvider>
      </Suspense>
    </LayerProvider>
  )
  const sync = (name: string) => Layer.succeed(Db, { name })
  const async = (name: string) => Layer.effect(Db, Effect.as(Effect.sleep('5 millis'), { name }))

  it.each([['sync', sync], ['async', async]] as const)('nested providers shadow like the client (%s layers)', async (_, make) => {
    const { html } = await stream(tree(make('parent'), make('child')))
    expect(html.replace(/<!-- -->/g, '')).toMatch(/<b>parent<\/b>.*<b>child<\/b><b>other<\/b>/)
  })

  it('an async-opening scope renders the Suspense fallback in string mode', async () => {
    const html = await renderWithAtoms(tree(async('parent'), async('child')))
    expect(html).toContain('outer-wait')
  })

  const tracked = (log: string[], name: string) =>
    Layer.scoped(Db, Effect.acquireRelease(Effect.succeed({ name }), () => Effect.sync(() => log.push(name))))
  const Opened = ({ log, name, children }: { log: string[]; name: string; children?: React.ReactNode }) => (
    <LayerProvider provide={[tracked(log, name)]}>{children}</LayerProvider>
  )

  it('closes registry scopes LIFO after completion, with no live atom fibers', async () => {
    const log: string[] = []
    let interrupted = 0
    const forever = Atom.make(Effect.never.pipe(Effect.onInterrupt(() => Effect.sync(() => void interrupted++))))
    const Read = () => <i>{useAtomValue(forever)._tag}</i>
    const { closed } = await stream(<Opened log={log} name="a"><Opened log={log} name="b"><Opened log={log} name="c"><Read /></Opened></Opened></Opened>)
    await sleep(1)
    expect(log).toEqual([]) // output ended, destination not finished yet
    await closed
    expect(log).toEqual(['c', 'b', 'a'])
    expect(interrupted).toBe(1)
  })

  it('closes registry scopes LIFO after a shell error', async () => {
    const log: string[] = []
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const Boom = () => { useService(Db); throw new Error('shell') }
    const s = renderWithAtoms(<Opened log={log} name="a"><Opened log={log} name="b"><Boom /></Opened></Opened>, {
      stream: { onError: () => {}, onShellError: () => {} },
    })
    await s.closed
    expect(log).toEqual(['b', 'a'])
  })

  it('closes registry scopes LIFO after abort, interrupting suspended atoms', async () => {
    const log: string[] = []
    let interrupted = 0
    const forever = Atom.make(Effect.never.pipe(Effect.onInterrupt(() => Effect.sync(() => void interrupted++))))
    const Wait = () => <i>{String(useAtomSuspense(forever).value)}</i>
    const s = renderWithAtoms(
      <Opened log={log} name="a"><Opened log={log} name="b"><Suspense fallback="w"><Wait /></Suspense></Opened></Opened>,
      { stream: { onError: () => {} } },
    )
    await sleep(10)
    s.abort()
    s.abort()
    await s.closed
    expect(log).toEqual(['b', 'a'])
    expect(interrupted).toBe(1)
  })

  it('a provider retried after suspension reuses its registry scope', async () => {
    const { useScopeSource } = await import('../managedScope')
    let opened = 0
    const layer = Layer.effect(Db, Effect.sync(() => (opened++, { name: 'once' })))
    let ready = false
    const gate = sleep(5).then(() => void (ready = true))
    const Probe = () => {
      const owned = useScopeSource({ provide: [layer] }, null, undefined).current!
      if (!ready) throw gate
      return <b>{owned.state.scopeState.status}</b>
    }
    const { html } = await stream(<Suspense fallback="w"><Probe /></Suspense>)
    expect(html).toContain('resolved')
    expect(opened).toBe(1)
  })

  it('concurrent streams with the same shape see only their own values; no parked-scope adoption', async () => {
    const timers = vi.spyOn(globalThis, 'setTimeout')
    const name = Atom.make(Effect.map(Db, (d) => d.name))
    const Read = () => <b>{useAtomSuspense(name).value}</b>
    const app = (value: string, ms: number) => (
      <LayerProvider provide={[Layer.effect(Db, Effect.as(Effect.sleep(ms), { name: value }))]}>
        <Suspense fallback="w"><Read /></Suspense>
        <LayerProvider provide={[]}><Suspense fallback="w"><Read /></Suspense></LayerProvider>
      </LayerProvider>
    )
    const [x, y] = await Promise.all([stream(app('first', 15)), stream(app('second', 3))])
    expect(x.html).toContain('first')
    expect(x.html).not.toContain('second')
    expect(y.html).toContain('second')
    expect(y.html).not.toContain('first')
    expect(timers.mock.calls.some(([, ms]) => ms === ADOPT_MS)).toBe(false)
    await Promise.all([x.closed, y.closed])
  })
})

describe('server render without renderWithAtoms', () => {
  it('serves atoms from an inert store (no fiber forked); outside a provider the existing error', () => {
    let ran = 0
    const count = Atom.make(2)
    const effect = Atom.make(Effect.sync(() => ++ran))
    const View = () => <span>{`${useAtomValue(count)}:${useAtomValue(effect)._tag}`}</span>
    expect(renderToString(<LayerProvider provide={[]}><View /></LayerProvider>)).toContain('2:Initial')
    expect(ran).toBe(0)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderToString(<View />)).toThrow(/needs a <LayerProvider>/)
  })
})
