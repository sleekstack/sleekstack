/**
 * Kit SSR prefetch facade (fn-16 R1): `prefetch` + `<HydrateQueries>` + the `serializable` codec, and their named errors.
 */
import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { prerender } from 'react-dom/static'
import { Hydrate } from '@sleekstack/query'
import { cachedQuery, layer, tag, type CachedQuery } from '../index'
import { HydrateQueries, LayerProvider, useQuery } from '../react'
import { configureRuntime, prefetch } from '../next'

const Api = tag<{ get(id: string): string }>('HydrateApi')
configureRuntime({ provide: [layer(Api, { get: (id: string) => `v-${id}` })] })

const Show = ({ q }: { q: CachedQuery<unknown> }) => <i>{String(useQuery(q).data ?? 'pending')}</i>
const page = (state: Awaited<ReturnType<typeof prefetch>>, q: CachedQuery<unknown>) => (
  <LayerProvider provide={[]}><HydrateQueries state={state}><Show q={q} /></HydrateQueries></LayerProvider>
)


describe('kit SSR prefetch', () => {
  it('server HTML holds the prefetched value, through a custom codec', async () => {
    const q = cachedQuery({
      key: (id: string) => ['kit-hydrate', id],
      fetch: function* (id) { return { at: (yield* Api).get(id) } },
      serializable: { encode: (v) => v.at, decode: (raw) => ({ at: `${raw}!` }) },
    })
    const state = await prefetch([q('a')])
    const Json = ({ id }: { id: string }) => <i>{useQuery(q(id)).data?.at}</i>
    expect(renderToString(<LayerProvider provide={[]}><HydrateQueries state={state}><Json id="a" /></HydrateQueries></LayerProvider>)).toContain('v-a!')
  })

  it('a query without `serializable` fails closed, naming it', async () => {
    const q = cachedQuery({ key: (id: string) => ['kit-plain', id], fetch: function* (id) { return id } })
    await expect(prefetch([q('x')])).rejects.toMatchObject({ name: 'SleekStackError', code: 'Unknown', message: expect.stringContaining('["kit-plain","x"]') })
  })

  it('a throwing decode raises QueryDecodeFailed', async () => {
    const q = cachedQuery({
      key: (id: string) => ['kit-bad', id],
      fetch: function* (id) { return id },
      serializable: { encode: (v) => v, decode: () => { throw new Error('bad shape') } },
    })
    const state = await prefetch([q('x')])
    expect(() => renderToString(page(state, q('x')))).toThrow(expect.objectContaining({ code: 'QueryDecodeFailed', details: { key: '["kit-bad","x"]' } }))
  })

  it('kit/next registers its runner: an un-prefetched server read resolves app services', async () => {
    const q = cachedQuery({ key: (id: string) => ['kit-lazy2', id], fetch: function* (id) { return (yield* Api).get(id) }, serializable: true })
    const { prelude } = await prerender(<LayerProvider provide={[]}><Show q={q('y')} /></LayerProvider>)
    expect(await new Response(prelude).text()).toContain('v-y')
  })

  it('an un-prefetched server read without a runner raises NoServerRunner', async () => {
    const q = cachedQuery({ key: (id: string) => ['kit-lazy', id], fetch: function* (id) { return id }, serializable: true })
    Hydrate.setServerRunner(undefined) // last test: drops the runner kit/next registered
    const el = <LayerProvider provide={[]}><Show q={q('x')} /></LayerProvider>
    await expect(prerender(el)).rejects.toMatchObject({ name: 'SleekStackError', code: 'NoServerRunner' })
  })

})
