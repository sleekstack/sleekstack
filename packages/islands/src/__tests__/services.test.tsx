// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { layer, tag, withCleanup } from '@sleekstack/kit'
import { action, configureRuntime } from '@sleekstack/kit/next'
import { useService } from '@sleekstack/kit/react'
import { defineIslands } from '../index'

const App = tag<{ id: number }>('IslandsApp')
const Comp = tag<{ id: number }>('IslandsComp')
const Greeting = tag<string>('IslandsGreeting')

const flush = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)) })
const roots: Root[] = []
const mount = async (ui: React.ReactNode) => {
  const host = document.body.appendChild(document.createElement('div'))
  const root = createRoot(host)
  roots.push(root)
  await act(async () => root.render(ui))
  await flush()
  return { host, unmount: async () => { await act(async () => root.unmount()); await flush() } }
}
afterEach(async () => {
  for (const r of roots.splice(0)) await act(async () => r.unmount())
  await flush()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

const Show = () => <i>{`${useService(App).id}/${useService(Comp).id}`}</i>

describe('Island Effect handoff', () => {
  it('shares one app scope across Islands, separate component scopes, closes on last unmount in reverse order, rebuilds', async () => {
    const order: string[] = []
    let apps = 0
    let comps = 0
    const Island = defineIslands({ show: async () => ({ default: Show }) }, {
      provide: [layer(App, () => withCleanup({ id: ++apps }, () => void order.push('app')))],
    })
    const provide = [layer(Comp, () => withCleanup({ id: ++comps }, () => void order.push('comp')), [], { lifetime: 'component' })]
    const a = await mount(<Island name="show" props={{}} hydrate="load" provide={provide} />)
    const b = await mount(<Island name="show" props={{}} hydrate="load" provide={provide} />)
    expect([a.host.textContent, b.host.textContent]).toEqual(['1/1', '1/2'])
    await a.unmount()
    expect(order).toEqual(['comp'])
    await b.unmount()
    expect(order).toEqual(['comp', 'comp', 'app'])
    const c = await mount(<Island name="show" props={{}} hydrate="load" provide={provide} />)
    expect(c.host.textContent).toBe('2/3')
  })

  it('an interaction Island retries a failed app-scope build on its next event', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let attempt = 0
    const Island = defineIslands({ show: async () => ({ default: () => <i>{useService(App).id}</i> }) }, {
      provide: [layer(App, () => { if (++attempt === 1) throw new Error('boom'); return { id: attempt } })],
    })
    const { host } = await mount(<Island name="show" props={{}} hydrate="interaction" />)
    const box = host.querySelector('[data-island]')!
    await act(async () => void box.dispatchEvent(new Event('pointerdown', { bubbles: true })))
    await flush()
    expect(box.textContent).toBe('')
    await act(async () => void box.dispatchEvent(new Event('pointerdown', { bubbles: true })))
    await flush()
    expect(box.textContent).toBe('2')
  })

  it('a failed app-scope build fails the Island and retries on the next activation', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    let attempt = 0
    const Island = defineIslands({ show: async () => ({ default: () => <i>{useService(App).id}</i> }) }, {
      provide: [layer(App, () => { if (++attempt === 1) throw new Error('boom'); return { id: attempt } })],
    })
    const a = await mount(<Island name="show" props={{}} hydrate="load" />)
    expect(a.host.textContent).toBe('')
    expect(err.mock.calls.some((c) => String(c[0]).includes('[island show]'))).toBe(true)
    const b = await mount(<Island name="show" props={{}} hydrate="load" />)
    expect(b.host.textContent).toBe('2')
  })

  it('a distinct Tag sharing a key across app and component entries is DuplicateTag for that Island only; the same Tag shadows', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const Island = defineIslands({ show: async () => ({ default: () => <i>{useService(App).id}</i> }) }, {
      provide: [layer(App, { id: 1 })],
    })
    const bad = await mount(<Island name="show" props={{}} hydrate="load" provide={[layer(tag<{ id: number }>('IslandsApp'), { id: 3 })]} />)
    const shadow = await mount(<Island name="show" props={{}} hydrate="load" provide={[layer(App, { id: 2 })]} />)
    const good = await mount(<Island name="show" props={{}} hydrate="load" />)
    expect(bad.host.querySelector('[data-island]')!.innerHTML).toBe('')
    expect(err.mock.calls.some((c) => c[0] === '[island show]' && (c[1] as { code?: string })?.code === 'DuplicateTag')).toBe(true)
    expect([shadow.host.textContent, good.host.textContent]).toEqual(['2', '1'])
  })

  it('an error thrown in an Island logs and renders nothing for that Island only', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const Island = defineIslands({
      bad: async () => ({ default: () => { throw new Error('kaboom') } }),
      ok: async () => ({ default: () => <i>ok</i> }),
    })
    const bad = await mount(<Island name="bad" props={{}} hydrate="load" />)
    const ok = await mount(<Island name="ok" props={{}} hydrate="load" />)
    expect(bad.host.querySelector('[data-island]')!.innerHTML).toBe('')
    expect(ok.host.textContent).toBe('ok')
    expect(err.mock.calls.some((c) => c[0] === '[island bad]' && (c[1] as Error)?.message === 'kaboom')).toBe(true)
  })

  it('a kit action() call from an Island works', async () => {
    configureRuntime({ provide: [layer(Greeting, 'hi')] })
    const greet = async (who: string) => action((hello) => (name: string) => `${hello} ${name}`, [Greeting])(who)
    const Btn = () => {
      const [text, setText] = useState('idle')
      return <button type="button" onClick={() => void greet('island').then((r) => setText(r.ok ? r.data : r.error))}>{text}</button>
    }
    const Island = defineIslands({ btn: async () => ({ default: Btn }) })
    const { host } = await mount(<Island name="btn" props={{}} hydrate="load" />)
    await act(async () => host.querySelector('button')!.click())
    await flush()
    expect(host.textContent).toBe('hi island')
  })
})
