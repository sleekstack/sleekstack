// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import { Atom, type AtomStore, makeAtomStore, Result } from '@sleekstack/core'
import { QueryClientLive, QueryClientTag } from '@sleekstack/query'
import { mount, type Mounted, Store, useAtomValue } from '@sleekstack/ui'
import { jsx as rawJsx } from '@sleekstack/ui/jsx-runtime'
import { dehydrate, hydrate, QueryClient } from '@tanstack/query-core'
import { Cause, Data, Deferred, Effect, Exit, FiberId, Layer, ManagedRuntime, Option, ParseResult } from 'effect'
import * as Schema from 'effect/Schema'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, expectTypeOf, it } from 'vitest'
import { defineRecord, defineTransformation, field, type RecordAdapter, useRecord } from '../index'
import { queryOf } from '../query'
import { slotOf } from '../registry'

const jsx = (type: any, props: any) => rawJsx(type, props)
const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))
const tick = () => new Promise((r) => setTimeout(r, 0))

type PostWire = { readonly id: string; readonly title: string; readonly likes: string }
class NotFound extends Data.TaggedError('NotFound')<{ readonly id: string }> {}
class PostApi extends Effect.Tag('PostApi')<PostApi, RecordAdapter<PostWire, unknown, NotFound>>() {}

const Post = defineRecord('post', {
  fields: { id: Schema.String, title: Schema.String, likes: Schema.NumberFromString },
  adapter: PostApi,
})
// Another record type over the same adapter, with ids shared with Post.
const Page = defineRecord('page', {
  fields: { id: Schema.String, title: Schema.String, likes: Schema.NumberFromString },
  adapter: PostApi,
})
const post = (title: string): PostWire => ({ id: '1', title, likes: '2' })
const record = (title: string) => ({ id: '1', title, likes: 2 })

/** An adapter whose `find` waits until the test answers it; `save` echoes the change as the saved record. */
const gated = () => {
  const calls: Array<Deferred.Deferred<PostWire, NotFound>> = []
  const interrupted: Array<number> = []
  const layer = Layer.succeed(PostApi, {
    find: () =>
      Effect.suspend(() => {
        const reply = Deferred.unsafeMake<PostWire, NotFound>(FiberId.none)
        const i = calls.push(reply) - 1
        return Effect.onInterrupt(Deferred.await(reply), () => Effect.sync(() => void interrupted.push(i)))
      }),
    save: (id, change) => Effect.succeed({ id, ...(change as Omit<PostWire, 'id'>) }),
  })
  const answer = (i: number, wire: PostWire) => Effect.runSync(Deferred.succeed(calls[i]!, wire))
  const fail = (i: number) => Effect.runSync(Deferred.fail(calls[i]!, new NotFound({ id: '1' })))
  return { calls, interrupted, layer, answer, fail }
}

const config = { defaultOptions: { queries: { staleTime: Infinity } } }
/** The Query Client Layer, given the Store and the adapter Layer as the binding requires. */
const clientLayer = (store: AtomStore, api: Layer.Layer<PostApi>) =>
  QueryClientLive(config).pipe(Layer.provideMerge(Layer.merge(Layer.succeed(Store, store), api)))

const setup = async () => {
  const store = makeAtomStore()
  const api = gated()
  const rt = ManagedRuntime.make(clientLayer(store, api.layer))
  const client = await rt.runPromise(QueryClientTag)
  return { store, api, rt, client }
}

/** Commits `title` as post 1 from its derived Draft. */
const commit = (rt: ManagedRuntime.ManagedRuntime<Store | PostApi | QueryClientTag, unknown>, s: AtomStore) => {
  if (Option.isNone(s.get(Post.atom('1')))) Effect.runSync(Effect.provideService(Post.push(post('A')), Store, s))
  const draft = Effect.runSync(Effect.provideService(Post.useDraft('1'), Store, s))
  s.retain(draft.value)
  return (title: string) => (s.set(draft.field('title'), title), rt.runPromise(Post.commit('1', draft)))
}

const ackedAt = (s: AtomStore) => Option.getOrThrow(s.get(slotOf(s, 'post', '1')).ackedAt)

// A transformation that hydrates but whose `serialize` always fails: reads and acknowledgements never serialize.
const serializeCalls = { count: 0 }
const Brittle = defineTransformation('brittle', () => ({
  from: Schema.String,
  to: Schema.String,
  hydrate: (s: string) => Effect.succeed(s.toUpperCase()),
  serialize: () =>
    Effect.sync(() => void serializeCalls.count++).pipe(
      Effect.zipRight(Effect.fail(new ParseResult.Type(Schema.String.ast, '', 'no'))),
    ),
  defaultValue: () => '',
}))
type NoteWire = { readonly id: string; readonly text: string | undefined }
class NoteApi extends Effect.Tag('NoteApi')<NoteApi, RecordAdapter<NoteWire, unknown, NotFound>>() {}
const Note = defineRecord('note', { fields: { id: Schema.String, text: field(Brittle) }, adapter: NoteApi })

describe('queryOf(record).query', () => {
  it('a read never runs a transformation serialize, so a successful hydrate is a successful query', async () => {
    const store = makeAtomStore()
    const api = Layer.succeed(NoteApi, {
      find: () => Effect.succeed({ id: '1', text: 'hi' }),
      save: () => Effect.die('x'),
    })
    const rt = ManagedRuntime.make(
      QueryClientLive(config).pipe(Layer.provideMerge(Layer.merge(Layer.succeed(Store, store), api))),
    )
    const client = await rt.runPromise(QueryClientTag)
    serializeCalls.count = 0
    expect(await rt.runPromise(queryOf(Note).query('1'))).toEqual({ id: '1', text: 'HI' })
    expect(client.getQueryData(['note', '1'])).toEqual({ id: '1', text: 'hi' })
    expect(serializeCalls.count).toBe(0)
  })

  it('caches, de-duplicates and ingests a fetch into the map', async () => {
    const { store, api, rt, client } = await setup()
    const read = () => rt.runPromise(queryOf(Post).query('1'))
    const one = read()
    const two = read()
    await tick()
    expect(api.calls.length).toBe(1)
    api.answer(0, post('a'))
    expect(await Promise.all([one, two])).toEqual([record('a'), record('a')])
    expect(store.get(Post.atom('1'))).toEqual(Option.some(record('a')))
    expect(client.getQueryData(['post', '1'])).toEqual(post('a'))

    // A cache hit: no adapter call, the same record in the map.
    store.update(slotOf(store, 'post', '1'), (s) => ({ ...s, value: Option.none() }))
    expect(await read()).toEqual(record('a'))
    expect(api.calls.length).toBe(1)
    expect(store.get(Post.atom('1'))).toEqual(Option.some(record('a')))

    expectTypeOf<
      Effect.Effect.Error<ReturnType<ReturnType<typeof queryOf<'post', any, typeof PostApi>>['query']>>
    >().toEqualTypeOf<NotFound | ParseResult.ParseError>()
    expectTypeOf<
      Effect.Effect.Context<ReturnType<ReturnType<typeof queryOf<'post', any, typeof PostApi>>['query']>>
    >().toEqualTypeOf<QueryClientTag | Store | Schema.Struct.Context<any>>()
  })

  it('a hydrated state fills the same record atom as a fetch, with no adapter call', async () => {
    const server = new QueryClient()
    server.setQueryData(['post', '1'], post('hydrated'))
    const { store, api, rt } = await setup()
    hydrate(await rt.runPromise(QueryClientTag), JSON.parse(JSON.stringify(dehydrate(server))))
    expect(await rt.runPromise(queryOf(Post).query('1'))).toEqual(record('hydrated'))
    expect(store.get(Post.atom('1'))).toEqual(Option.some(record('hydrated')))
    expect(api.calls.length).toBe(0)
  })

  it('a cache entry older than a committed save, hydrated or not, cannot overwrite the saved record', async () => {
    const { store, rt, client } = await setup()
    store.retain(Post.atom('1'))
    await commit(rt, store)('saved')
    const T = ackedAt(store)

    const server = new QueryClient()
    server.setQueryData(['post', '1'], post('old'), { updatedAt: T - 1000 })
    hydrate(client, JSON.parse(JSON.stringify(dehydrate(server))))
    expect(client.getQueryData(['post', '1'])).toEqual(post('old'))
    expect(await rt.runPromise(queryOf(Post).query('1'))).toEqual(record('saved'))
    expect(store.get(Post.atom('1'))).toEqual(Option.some(record('saved')))
  })

  it('a cache update and a save acknowledgement at the same time T: reading the cache keeps the saved record', async () => {
    const { store, rt, client } = await setup()
    await commit(rt, store)('saved')
    const T = ackedAt(store)
    client.setQueryData(['post', '1'], post('old'), { updatedAt: T })
    expect(await rt.runPromise(queryOf(Post).query('1'))).toEqual(record('saved'))
    expect(store.get(Post.atom('1'))).toEqual(Option.some(record('saved')))
  })

  it('after a read, a committed save writes its acknowledged wire into the query entry', async () => {
    const { store, api, rt, client } = await setup()
    // A record of another type with the same id, read first, does not stand in for this one.
    const page = rt.runPromise(queryOf(Page).query('1'))
    await tick()
    api.answer(0, post('page'))
    await page
    const read = rt.runPromise(queryOf(Post).query('1'))
    await tick()
    api.answer(1, post('a'))
    await read
    await commit(rt, store)('saved')
    expect(client.getQueryData(['post', '1'])).toEqual(post('saved'))
    expect(client.getQueryState(['post', '1'])?.dataUpdatedAt).toBe(ackedAt(store))
  })

  it('an evicted record whose entry is its last save is fetched again', async () => {
    const { store, api, rt } = await setup()
    const read = rt.runPromise(queryOf(Post).query('1'))
    await tick()
    api.answer(0, post('a'))
    await read
    await commit(rt, store)('saved')
    await rt.runPromise(Post.evict('1'))
    const again = rt.runPromise(queryOf(Post).query('1'))
    await tick()
    expect(api.calls.length).toBe(2)
    api.answer(1, post('fresh'))
    expect(await again).toEqual(record('fresh'))
    expect(store.get(Post.atom('1'))).toEqual(Option.some(record('fresh')))
  })

  it('an entry holding another id is a ParseError and fills no slot', async () => {
    const { store, rt, client } = await setup()
    client.setQueryData(['post', '2'], post('one'))
    const exit = await rt.runPromiseExit(queryOf(Post).query('2'))
    expect(Exit.isFailure(exit) && Option.getOrUndefined(Cause.failureOption(exit.cause))).toMatchObject({
      _tag: 'ParseError',
    })
    expect(store.get(Post.atom('2'))).toEqual(Option.none())
    expect(store.get(Post.atom('1'))).toEqual(Option.none())
  })

  it.each<[string, (s: AtomStore, api: Layer.Layer<PostApi>) => Layer.Layer<QueryClientTag, unknown>]>([
    ['Store', (_, api) => QueryClientLive(config).pipe(Layer.provide(api))],
    ['PostApi', (s) => QueryClientLive(config).pipe(Layer.provide(Layer.succeed(Store, s)))],
  ])('a missing %s in the Query Client Layer is a defect naming it', async (tag, layer) => {
    const store = makeAtomStore()
    const rt = ManagedRuntime.make(layer(store, gated().layer))
    const exit = await rt.runPromiseExit(
      Effect.provideService(queryOf(Post).query('1'), Store, store) as Effect.Effect<unknown, unknown, QueryClientTag>,
    )
    const defect = Exit.isFailure(exit) ? Cause.dieOption(exit.cause) : Option.none()
    expect(String(Option.getOrUndefined(defect))).toContain(tag)
  })
})

describe('useRecord via queryOf', () => {
  let mounts: Array<Mounted> = []
  beforeAll(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })
  afterEach(async () => {
    await act(async () => {
      for (const h of mounts) await h.dispose()
    })
    mounts = []
    document.body.replaceChildren()
  })

  const view = async () => {
    const api = gated()
    const store = makeAtomStore()
    const results: Array<Result.Result<{ readonly title: string }, unknown>> = []
    const box: { client?: QueryClient } = {}
    const View = function* () {
      box.client = yield* QueryClientTag
      const r = yield* useRecord(Post, '1', { via: queryOf(Post) })
      expectTypeOf(r).toEqualTypeOf<
        Result.Result<
          { readonly id: string; readonly title: string; readonly likes: number },
          NotFound | ParseResult.ParseError
        >
      >()
      results.push(r)
      return jsx('p', { children: Result.isSuccess(r) ? r.value.title : r._tag })
    }
    // The client outlives the view: `hide` unmounts only the view.
    const show = Atom.make(true)
    const Switch = function* () {
      return (yield* useAtomValue(show)) ? jsx(View, {}) : jsx('span', {})
    }
    const container = document.createElement('div')
    document.body.append(container)
    await act(
      async () =>
        void mounts.push(await mount(jsx(Switch, {}), { layer: clientLayer(store, api.layer), container, store })),
    )
    const entry = () => box.client!.getQueryCache().find({ queryKey: ['post', '1'], exact: true })!
    const toggle = (on: boolean) => act(async () => store.set(show, on))
    return { api, container, entry, toggle, last: () => results[results.length - 1]! }
  }

  it('waits, then succeeds with the map value, fetching through the Query Client and never through useQuery', async () => {
    const { api, container, entry, last } = await view()
    expect(last()).toEqual(Result.initial(true))
    expect(entry().state.fetchStatus).toBe('fetching')
    expect(entry().getObserversCount()).toBe(0)
    api.answer(0, post('a'))
    await flush()
    expect(container.textContent).toBe('a')
    expect(entry().state.data).toEqual(post('a'))
  })

  it('is a typed failure when the fetch fails', async () => {
    const { api, container, last } = await view()
    api.fail(0)
    await flush()
    expect(container.textContent).toBe('Failure')
    const r = last()
    expect(Result.isFailure(r) && Cause.failureOption(r.cause)).toEqual(Option.some(new NotFound({ id: '1' })))
  })

  it('unmounting during the fetch cancels the query and interrupts the adapter call, every time', async () => {
    const { api, entry, toggle } = await view()
    for (const i of [0, 1]) {
      if (i > 0) await toggle(true)
      expect(entry().state.fetchStatus).toBe('fetching')
      expect(api.calls.length).toBe(i + 1)
      await toggle(false)
      await flush()
      expect(entry().state.fetchStatus).toBe('idle')
      expect(api.interrupted).toEqual(i === 0 ? [0] : [0, 1])
    }
    expect(entry().state.data).toBeUndefined()
  })
})

it('only the ./query entry needs @sleekstack/query, as an optional peer', () => {
  const pkg = JSON.parse(readFileSync(path.join(__dirname, '../../package.json'), 'utf8'))
  expect(pkg.exports['./query']).toEqual({ types: './dist/query.d.ts', default: './dist/query.js' })
  // The base entry's side is in adapter.test.ts.
  expect(pkg.peerDependenciesMeta['@tanstack/query-core']).toEqual({ optional: true })
})
