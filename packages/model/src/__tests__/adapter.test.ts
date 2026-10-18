// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import { type AtomStore, makeAtomStore, Result } from '@sleekstack/core'
import { mount, type Mounted, Store } from '@sleekstack/ui'
import { jsx as rawJsx } from '@sleekstack/ui/jsx-runtime'
import { Cause, Data, Deferred, Effect, Exit, FiberId, Layer, Option, type ParseResult } from 'effect'
import * as Schema from 'effect/Schema'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, expectTypeOf, it } from 'vitest'
import { stamp } from '../adapter'
import { defineRecord, type RecordAdapter, useRecord } from '../index'
import { slotOf } from '../registry'

const jsx = (type: any, props: any) => rawJsx(type, props)
const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))

type PostWire = { readonly id: string; readonly title: string; readonly likes: string }
class NotFound extends Data.TaggedError('NotFound')<{ readonly id: string }> {}
class PostApi extends Effect.Tag('PostApi')<PostApi, RecordAdapter<PostWire, unknown, NotFound>>() {}

const Post = defineRecord('post', {
  fields: { id: Schema.String, title: Schema.String, likes: Schema.NumberFromString },
  adapter: PostApi,
})
const Note = defineRecord('note', { fields: { id: Schema.String } })

/** An adapter whose `find` waits until the test answers it: `answer(i, wire)` or `fail(i)` settles the i-th call. */
const gated = () => {
  const calls: Array<{ id: string; reply: Deferred.Deferred<PostWire, NotFound>; interrupted: boolean }> = []
  const layer = Layer.succeed(PostApi, {
    find: (id) =>
      Effect.suspend(() => {
        const call = { id, reply: Deferred.unsafeMake<PostWire, NotFound>(FiberId.none), interrupted: false }
        calls.push(call)
        return Effect.onInterrupt(Deferred.await(call.reply), () =>
          // Asynchronous cleanup: `dispose` must wait for it.
          Effect.delay(
            Effect.sync(() => void (call.interrupted = true)),
            '10 millis',
          ),
        )
      }),
    save: () => Effect.die('unused'),
  })
  const answer = (i: number, wire: PostWire) => Effect.runSync(Deferred.succeed(calls[i]!.reply, wire))
  const fail = (i: number) => Effect.runSync(Deferred.fail(calls[i]!.reply, new NotFound({ id: calls[i]!.id })))
  return { calls, layer, answer, fail }
}

const start = <A, E>(s: AtomStore, layer: Layer.Layer<PostApi>, e: Effect.Effect<A, E, Store | PostApi>) =>
  Effect.runPromiseExit(e.pipe(Effect.provide(layer), Effect.provideService(Store, s)))
const tick = () => new Promise((r) => setTimeout(r, 0))
const post = (title: string): PostWire => ({ id: '1', title, likes: '2' })

describe('find through the adapter', () => {
  it('works without @sleekstack/query, and a missing adapter Layer is in R', () => {
    const pkg = JSON.parse(readFileSync(path.join(__dirname, '../../package.json'), 'utf8'))
    expect(JSON.stringify(pkg)).not.toContain('@sleekstack/query')
    expectTypeOf<Effect.Effect.Context<ReturnType<typeof Post.find>>>().toEqualTypeOf<Store | PostApi>()
    expectTypeOf<Effect.Effect.Error<ReturnType<typeof Post.find>>>().toEqualTypeOf<NotFound | ParseResult.ParseError>()
    // @ts-expect-error a record with no adapter has no find
    void Note.find
  })

  it('one record over two adapter Layers with different envelopes', async () => {
    // Two fake servers: each Layer removes its own envelope.
    const rest = (id: string) => ({ data: { id, title: 'rest', likes: '3' } })
    const graphql = (id: string) => ({ post: { node: { id, title: 'graphql', likes: '4' } } })
    const restLayer = Layer.succeed(PostApi, {
      find: (id) => Effect.succeed(rest(id).data),
      save: () => Effect.die('unused'),
    })
    const graphqlLayer = Layer.succeed(PostApi, {
      find: (id) => Effect.succeed(graphql(id).post.node),
      save: () => Effect.die('unused'),
    })
    const a = makeAtomStore()
    const b = makeAtomStore()
    expect(await start(a, restLayer, Post.find('1'))).toEqual(Exit.succeed({ id: '1', title: 'rest', likes: 3 }))
    expect(await start(b, graphqlLayer, Post.find('1'))).toEqual(Exit.succeed({ id: '1', title: 'graphql', likes: 4 }))
    expect(a.get(Post.atom('1'))).toEqual(Option.some({ id: '1', title: 'rest', likes: 3 }))
    expect(b.get(Post.atom('1'))).toEqual(Option.some({ id: '1', title: 'graphql', likes: 4 }))
  })

  it('concurrent finds of one id make one adapter call; a failed call is not reused', async () => {
    const s = makeAtomStore()
    const api = gated()
    const one = start(s, api.layer, Post.find('1'))
    const two = start(s, api.layer, Post.find('1'))
    await tick()
    expect(api.calls.length).toBe(1)
    api.fail(0)
    expect(Exit.isFailure(await one) && Cause.failureOption(((await one) as Exit.Failure<any, any>).cause)).toEqual(
      Option.some(new NotFound({ id: '1' })),
    )
    expect(await two).toEqual(await one)
    const three = start(s, api.layer, Post.find('1'))
    await tick()
    expect(api.calls.length).toBe(2)
    api.answer(1, post('a'))
    expect(await three).toEqual(Exit.succeed({ id: '1', title: 'a', likes: 2 }))
  })

  it('drops a response older than the last acknowledgement', async () => {
    const s = makeAtomStore()
    const api = gated()
    const pending = start(s, api.layer, Post.find('1'))
    await tick()
    s.update(slotOf(s, 'post', '1'), (slot) => ({ value: Option.some(post('acked')), ackedAt: Option.some(stamp()) }))
    api.answer(0, post('stale'))
    await pending
    expect(s.get(Post.atom('1'))).toEqual(Option.some(post('acked')))
  })

  it('disposing the Store during a find interrupts it and writes nothing', async () => {
    const s = makeAtomStore()
    const api = gated()
    const pending = start(s, api.layer, Post.find('1'))
    await tick()
    await s.dispose()
    expect(api.calls[0]!.interrupted).toBe(true)
    expect(Exit.isInterrupted(await pending)).toBe(true)
  })
})

describe('useRecord', () => {
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

  const view = async (id: string) => {
    const api = gated()
    const results: Array<Result.Result<{ readonly title: string }, unknown>> = []
    const View = function* () {
      const r = yield* useRecord(Post, id)
      expectTypeOf(r).toEqualTypeOf<
        Result.Result<
          { readonly id: string; readonly title: string; readonly likes: number },
          NotFound | ParseResult.ParseError
        >
      >()
      results.push(r)
      return jsx('p', { children: Result.isSuccess(r) ? r.value.title : r._tag })
    }
    const container = document.createElement('div')
    document.body.append(container)
    const store = makeAtomStore()
    await act(async () => void mounts.push(await mount(jsx(View, {}), { layer: api.layer, container, store })))
    return { api, results, container, store, last: () => results[results.length - 1]! }
  }

  it('waits on first load, then shows the record from the map, and keeps it during a refetch', async () => {
    const { api, container, store, last } = await view('1')
    expect(last()).toEqual(Result.initial(true))
    api.answer(0, post('a'))
    await flush()
    expect(container.textContent).toBe('a')
    expect(Result.isSuccess(last())).toBe(true)

    const refetch = start(store, api.layer, Post.find('1'))
    await flush()
    expect(api.calls.length).toBe(2)
    expect(container.textContent).toBe('a')
    api.answer(1, post('b'))
    await refetch
    await flush()
    expect(container.textContent).toBe('b')
  })

  it('is a typed failure when the slot is empty and find failed', async () => {
    const { api, container, last } = await view('2')
    api.fail(0)
    await flush()
    expect(container.textContent).toBe('Failure')
    const r = last()
    expect(Result.isFailure(r) && Cause.failureOption(r.cause)).toEqual(Option.some(new NotFound({ id: '2' })))
  })

  it('a synchronous fetch strategy that fills the map is a success', async () => {
    const shown: Array<Result.Result<{ readonly id: string }, unknown>> = []
    const View = function* () {
      const r = yield* useRecord(Note, 'n', { via: { fetch: (id) => Note.push({ id }) } })
      shown.push(r)
      return jsx('p', { children: r._tag })
    }
    const container = document.createElement('div')
    document.body.append(container)
    await act(
      async () =>
        void mounts.push(await mount(jsx(View, {}), { layer: Layer.empty, container, store: makeAtomStore() })),
    )
    // Every run, the first included, sees the record the fetch wrote.
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.every((r) => Result.isSuccess(r) && r.value.id === 'n')).toBe(true)

    // Outside a component too.
    const outside = useRecord(Note, 'm', { via: { fetch: (id) => Note.push({ id }) } })
    expect(Effect.runSync(Effect.provideService(outside, Store, makeAtomStore()))).toEqual(Result.success({ id: 'm' }))
  })
})
