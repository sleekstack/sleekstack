import { router, routes } from '@sleekstack/router'
import { el } from '@sleekstack/ui'
import { Effect } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { start } from '../index'

// No plugin serves the discovered app here: `start` gets its stand-in, nothing discovered, unless a test mocks it.
const DISCOVERED = '../discovered'

const pageSaying = (text: string) =>
  router({
    table: routes({ home: '/' }),
    pages: { home: { render: () => Effect.succeed(el('p', {}, text)) } },
    notFound: () => Effect.succeed(el('p', {}, 'missing')),
  })

const home = () => new Request('http://x.test/')

afterEach(() => {
  vi.doUnmock(DISCOVERED)
})

describe('the discovered app', () => {
  it('with no options and nothing discovered, every request fails naming the plugin', async () => {
    const app = start()
    for (let i = 0; i < 2; i++)
      await expect(app.fetch(home())).rejects.toThrow(
        'Add serverServices() or sleekstack() from @sleekstack/ui-vite to the Vite config',
      )
  })

  it('with options, nothing discovered and no router, a page answers 404', async () => {
    const res = await start({ handlers: {} }).fetch(home())
    expect([res.status, await res.text()]).toEqual([404, ''])
  })

  it("serves the discovered router's pages; an explicit router wins", async () => {
    vi.doMock(DISCOVERED, () => ({ default: { controllers: [], router: pageSaying('discovered') } }))
    expect(await (await start().fetch(home())).text()).toContain('<p>discovered</p>')
    expect(await (await start({ router: pageSaying('explicit') }).fetch(home())).text()).toContain('<p>explicit</p>')
  })
})
