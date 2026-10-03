/**
 * packages/query/src/__tests__/hydrate.test.ts
 *
 * SSR prefetch / dehydrate / hydrate (fn-12 task .6, R7).
 */
import { describe, expect, it } from 'vitest'
import { Context, Effect, Option, Schema } from 'effect'
import { makeAtomStore } from '@sleekstack/core'
import { Hydrate, Queries, Query } from '../index'

class Api extends Context.Tag('Api')<Api, { readonly get: (id: string) => Effect.Effect<{ title: string }, 'nope'> }>() {}
const Dto = Schema.Struct({ title: Schema.String })

const setup = (fail = false) => {
  const calls = { n: 0 }
  const todo = Hydrate.hydratable(
    Query.make({
      key: (id: string) => ['todo', id],
      fetch: (id) => Effect.flatMap(Api, (api) => api.get(id)),
      staleTime: '1 minute',
    }),
    { value: Dto, error: Schema.Literal('nope') },
  )
  const api = { get: (id: string) => Effect.suspend(() => { calls.n++; return fail ? Effect.fail('nope' as const) : Effect.succeed({ title: `${id}#${calls.n}` }) }) }
  const context = Context.make(Api, api)
  return { todo, calls, context, prefetch: (opts?: Hydrate.DehydrateOptions) => Effect.runPromise(Effect.provide(Hydrate.prefetch([todo("t1")], opts), context) as Effect.Effect<Hydrate.Dehydrated>) }
}

describe('Hydrate', () => {
  it('prefetch dehydrates; hydrate seeds without a fetch and stays fresh until staleTime', async () => {
    const { todo, calls, context, prefetch } = setup()
    const state = await prefetch()
    expect(state).toEqual([{ key: '["todo","t1"]', result: 'success', value: { title: 't1#1' }, updatedAt: expect.any(Number) }])
    const store = makeAtomStore({ context })
    Hydrate.hydrate(store, JSON.parse(JSON.stringify(state)))
    Hydrate.apply(store, todo('t1'))
    const release = Query.observe(store, todo('t1'))
    expect(Queries.make(store).getData(todo('t1'))).toEqual(Option.some({ title: 't1#1' }))
    Query.trigger(store, todo('t1')) // stale-gated trigger: still fresh
    expect(calls.n).toBe(1)
    release()
  })

  it('a failed prefetch is dehydrated only when opted in', async () => {
    expect(await setup(true).prefetch()).toEqual([])
    expect(await setup(true).prefetch({ failures: true })).toMatchObject([{ result: 'failure', error: 'nope' }])
  })

  it('a mounted key keeps the newer updatedAt', async () => {
    const { todo, context, prefetch } = setup()
    const state = await prefetch()
    const store = makeAtomStore({ context })
    const release = Query.observe(store, todo('t1')) // fetches t1#2, after the server's
    Hydrate.hydrate(store, state)
    Hydrate.apply(store, todo('t1'))
    expect(Queries.make(store).getData(todo('t1'))).toEqual(Option.some({ title: 't1#2' }))
    release()
  })

  it('a value failing its Schema is dropped and refetched', async () => {
    const { todo, calls, context } = setup()
    const store = makeAtomStore({ context })
    Hydrate.hydrate(store, [{ key: '["todo","t1"]', result: 'success', value: { title: 42 }, updatedAt: Date.now() }])
    Hydrate.apply(store, todo('t1'))
    const release = Query.observe(store, todo('t1'))
    expect(calls.n).toBe(1)
    expect(Queries.make(store).getData(todo('t1'))).toEqual(Option.some({ title: 't1#1' }))
    release()
  })
})
