import { NotFound, notFound, Redirect, redirect, router, routes } from '@sleekstack/router'
import { el } from '@sleekstack/ui'
import { Cause, Data, Effect, Layer, Schema } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DuplicateServerFn,
  InvalidServerFnId,
  serverFn,
  ServerService,
  type ServerServiceEntry,
  start,
  taggedError,
} from '../index'

class NameTaken extends Data.TaggedError('NameTaken')<{ readonly name: string }> {}

class Profiles extends ServerService('Profiles')<
  Profiles,
  {
    readonly rename: (input: {
      readonly name: string
    }) => Effect.Effect<{ readonly name: string }, NameTaken | Redirect | NotFound>
    readonly count: () => Effect.Effect<number>
  }
>() {}

const entry: ServerServiceEntry<Profiles, Profiles['Type']> = {
  tag: Profiles,
  methods: {
    rename: {
      input: Schema.Struct({ name: Schema.String }),
      success: Schema.Struct({ name: Schema.String }),
      error: taggedError(NameTaken, { name: Schema.String }),
    },
    count: { input: Schema.Void, success: Schema.Number },
  },
}

const rename = vi.fn((input: { readonly name: string }) => {
  switch (input.name) {
    case 'taken':
      return Effect.fail(new NameTaken({ name: input.name }))
    case 'away':
      return redirect('/login')
    case 'missing':
      return notFound()
    case 'undeclared':
      return Effect.fail(new Error('undeclared secret') as never)
  }
  return Effect.succeed({ name: input.name, secret: 'not serialized' })
})
const layer = Layer.succeed(Profiles, { rename, count: () => Effect.succeed(3) })

const app = router({
  table: routes({ home: '/' }),
  pages: { home: { render: () => Effect.succeed(el('p', {}, 'home')) } },
  notFound: () => Effect.succeed(el('p', {}, 'missing')),
})

const errors: Cause.Cause<unknown>[] = []
const server = start({ router: app, layer, services: [entry], onError: (cause) => void errors.push(cause) })

const origin = 'http://x.test'
const call = (id: string, body?: string) =>
  server.fetch(new Request(`${origin}/_sleek/fn/${id}`, { method: 'POST', body, headers: { origin } }))
const answer = async (res: Response) => [res.status, await res.text()]

afterEach(() => {
  rename.mockClear()
  errors.length = 0
})

describe('a Server Service method on the wire', () => {
  it('success is encoded with the success Schema; a void method takes no body', async () => {
    expect(await answer(await call('Profiles.rename', '{"name":"ada"}'))).toEqual([
      200,
      JSON.stringify({ _tag: 'Success', value: { name: 'ada' } }),
    ])
    expect(await answer(await call('Profiles.count'))).toEqual([200, JSON.stringify({ _tag: 'Success', value: 3 })])
  })

  it('a declared error is the Failure envelope', async () => {
    expect(await answer(await call('Profiles.rename', '{"name":"taken"}'))).toEqual([
      200,
      JSON.stringify({ _tag: 'Failure', error: { _tag: 'NameTaken', name: 'taken' } }),
    ])
  })

  it.each([
    ['away', 302, { _tag: 'Redirect', to: '/login' }],
    ['missing', 404, { _tag: 'NotFound' }],
  ])('%s from the implementation answers as on a server function', async (name, status, envelope) => {
    expect(await answer(await call('Profiles.rename', JSON.stringify({ name })))).toEqual([
      status,
      JSON.stringify(envelope),
    ])
  })

  it('an undeclared failure reaches the error sink and answers an empty 500', async () => {
    expect(await answer(await call('Profiles.rename', '{"name":"undeclared"}'))).toEqual([500, ''])
    expect(errors.map((c) => Cause.pretty(c)).join()).toContain('undeclared secret')
  })

  it('input failing the input Schema is a 400 DecodeError and the implementation never runs', async () => {
    const res = await call('Profiles.rename', '{"name":1}')
    expect([res.status, (await res.json())._tag]).toEqual([400, 'DecodeError'])
    expect(rename).not.toHaveBeenCalled()
  })
})

describe('ids', () => {
  const thrown = (f: () => unknown) => {
    try {
      f()
    } catch (e) {
      return e
    }
  }
  const ping = (id: string) => serverFn(id, { input: Schema.Void, success: Schema.Void })(function* () {})

  it('a method id equal to a server function id fails start with DuplicateServerFn', () => {
    const e = thrown(() => start({ router: app, layer, functions: [ping('Profiles.count')], services: [entry] }))
    expect([e instanceof DuplicateServerFn, e]).toEqual([true, expect.objectContaining({ id: 'Profiles.count' })])
  })

  it.each([
    ['a Tag id', ServerService('.Bad')<never, { readonly go: () => Effect.Effect<void> }>(), 'go', '.Bad.go'],
    ['a method name', Profiles, 'a b', 'Profiles.a b'],
  ])('%s outside the grammar fails start with InvalidServerFnId', (_, tag, method, id) => {
    const bad = { tag, methods: { [method]: { input: Schema.Void, success: Schema.Void } } } as ServerServiceEntry
    const e = thrown(() => start({ router: app, layer: Layer.empty, services: [bad] } as never))
    expect([e instanceof InvalidServerFnId, e]).toEqual([true, expect.objectContaining({ id })])
  })
})

describe('taggedError', () => {
  const schema = taggedError(NameTaken, { name: Schema.String })

  it('round-trips a Data.TaggedError into its class', () => {
    const encoded = Schema.encodeSync(schema)(new NameTaken({ name: 'ada' }))
    expect(JSON.parse(JSON.stringify(encoded))).toEqual({ _tag: 'NameTaken', name: 'ada' })
    const decoded = Schema.decodeUnknownSync(schema)({ _tag: 'NameTaken', name: 'ada' })
    expect([decoded instanceof NameTaken, decoded.name]).toEqual([true, 'ada'])
  })

  it('Schema.is is an instance check', () => {
    expect(Schema.is(schema)({ _tag: 'NameTaken', name: 'ada' })).toBe(false)
    expect(Schema.is(schema)(new NameTaken({ name: 'ada' }))).toBe(true)
  })
})
