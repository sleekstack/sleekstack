import { NotFound, Redirect, redirect } from '@sleekstack/router'
import {
  Controller,
  type ControllerEntry,
  Cookies,
  DecodeError,
  type DiscoveredApp,
  type DiscoveredService,
  type Gen,
  type GeneratedServiceShape,
  implement,
  serverFn,
  ServerService,
  type ServerServiceEntry,
  type ServerServiceEntryOf,
  serviceLayer,
  start,
  taggedError,
} from '@sleekstack/start'
import { Cause, Context, Data, Effect, Exit, Layer, Option, Schema } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { callController, callHandler, callServerFn, callService } from '../index'

class Names extends Context.Tag('Names')<Names, { readonly taken: ReadonlySet<string> }>() {}
class NameTaken extends Schema.TaggedError<NameTaken>()('NameTaken', { name: Schema.String }) {}

const rename = serverFn('profile.rename', {
  input: Schema.Struct({ name: Schema.NonEmptyString }),
  success: Schema.Struct({ name: Schema.String }),
  error: NameTaken,
})(function* ({ name }) {
  if (name === 'boom') return yield* Effect.die(new Error('secret'))
  if (name === 'away') return yield* redirect('/login')
  if ((yield* Names).taken.has(name)) return yield* new NameTaken({ name })
  const session = (yield* Cookies).get('session')
  return { name: `${name} by ${session}`, extra: 'dropped' }
})

// What `serverServices()` would serve as `virtual:sleek/server-app`; nothing is discovered unless a test sets it.
const discovered: { app?: DiscoveredApp } = {}
// `start` imports its stand-in for the discovered app from its own `dist`, on the first request.
vi.mock('../../../start/dist/discovered.js', () => ({
  get default() {
    return discovered.app
  },
}))

const layer = Layer.succeed(Names, { taken: new Set(['ada']) })
const failure = (exit: Exit.Exit<unknown, unknown>) =>
  Exit.isFailure(exit) ? Option.getOrUndefined(Cause.failureOption(exit.cause)) : undefined

describe('callServerFn', () => {
  it('runs the function with the layer and the request headers, encoding only the success Schema', async () => {
    const exit = await callServerFn(rename, { name: 'grace' }, { layer, headers: { cookie: 'session=s1' } })
    expect(exit).toEqual(Exit.succeed({ name: 'grace by s1' }))
  })

  it('a declared error comes back typed', async () => {
    const exit = await callServerFn(rename, { name: 'ada' }, { layer })
    expect(exit).toEqual(Exit.fail(new NameTaken({ name: 'ada' })))
  })

  it('input failing the Schema is the server decode: a DecodeError with field issues, the body not run', async () => {
    const exit = await callServerFn(rename, { name: '' }, { layer: Layer.empty as Layer.Layer<Names> })
    expect(failure(exit)).toBeInstanceOf(DecodeError)
    expect((failure(exit) as DecodeError).issues.map((i) => i.path)).toEqual([['name']])
  })

  it('a redirect is the router Redirect; a defect is the cause the error sink got', async () => {
    const away = await callServerFn(rename, { name: 'away' }, { layer })
    expect(failure(away)).toEqual(new Redirect({ to: '/login' }))
    const boom = await callServerFn(rename, { name: 'boom' }, { layer })
    expect(Exit.isFailure(boom) && Cause.squash(boom.cause)).toEqual(new Error('secret'))
  })
})

class Taken extends Data.TaggedError('Taken')<{ readonly name: string }> {}
class Profiles extends ServerService('Profiles')<
  Profiles,
  { readonly rename: (input: { readonly name: string }) => Effect.Effect<{ readonly name: string }, Taken> }
>() {}
const profiles: ServerServiceEntry<Profiles, Profiles['Type']> = {
  tag: Profiles,
  methods: {
    rename: {
      input: Schema.Struct({ name: Schema.NonEmptyString }),
      success: Schema.Struct({ name: Schema.String }),
      error: taggedError(Taken, { name: Schema.String }),
    },
  },
}
// A test Layer: no transformer, no network.
const profilesLayer = Layer.succeed(Profiles, {
  rename: ({ name }) =>
    name === 'ada'
      ? Effect.fail(new Taken({ name }))
      : name === 'boom'
        ? Effect.die(new Error('secret'))
        : Effect.succeed({ name }),
})

// @ts-expect-error an unknown method name is a type error
void (() => callService(profiles, 'remove', { name: 'x' }, { layer: profilesLayer }))

// The generated registry types each entry with its Tag's methods, so an entry picked from it rejects unknown names too.
declare const generated: ReadonlyArray<ServerServiceEntryOf<typeof Profiles>>
// @ts-expect-error an unknown method name is a type error on a generated entry
void (() => callService(generated[0]!, 'remove', { name: 'x' }, { layer: profilesLayer }))

describe('callService', () => {
  it('success and a declared error decoded back into its class', async () => {
    expect(await callService(profiles, 'rename', { name: 'grace' }, { layer: profilesLayer })).toEqual(
      Exit.succeed({ name: 'grace' }),
    )
    const taken = await callService(profiles, 'rename', { name: 'ada' }, { layer: profilesLayer })
    expect(failure(taken)).toBeInstanceOf(Taken)
  })

  it('bad input is a DecodeError; a defect is the cause the error sink got', async () => {
    const bad = await callService(profiles, 'rename', { name: '' }, { layer: profilesLayer })
    expect(failure(bad)).toBeInstanceOf(DecodeError)
    const boom = await callService(profiles, 'rename', { name: 'boom' }, { layer: profilesLayer })
    expect(Exit.isFailure(boom) && Cause.squash(boom.cause)).toEqual(new Error('secret'))
  })

  it('an implement Layer gets the request services per call', async () => {
    const live = implement(Profiles, {
      rename: ({ name }) => Effect.map(Cookies, (cookies) => ({ name: `${name} by ${cookies.get('session')}` })),
    })
    const exit = await callService(
      profiles,
      'rename',
      { name: 'grace' },
      { layer: live, headers: { cookie: 'session=s1' } },
    )
    expect(exit).toEqual(Exit.succeed({ name: 'grace by s1' }))
  })
})

describe('callHandler', () => {
  const handler = {
    GET: () =>
      Effect.gen(function* () {
        yield* (yield* Cookies).set('seen', '1')
        return new Response([...(yield* Names).taken].join())
      }),
    DELETE: () => Effect.fail(new NotFound()),
  }

  it('answers through the request services with the layer', async () => {
    const res = await callHandler(handler, new Request('http://x.test/names'), { layer })
    expect(await res.text()).toBe('ada')
    expect(res.headers.get('set-cookie')).toBe('seen=1')
  })

  it('an unsupported method is 405 with Allow; control flow is 404', async () => {
    const put = await callHandler(handler, new Request('http://x.test/names', { method: 'PUT' }), { layer })
    expect([put.status, put.headers.get('allow')]).toEqual([405, 'GET, DELETE'])
    const del = await callHandler(handler, new Request('http://x.test/names', { method: 'DELETE' }), { layer })
    expect(del.status).toBe(404)
  })
})

describe('callController', () => {
  // A referenced Schema: what the generated entry carries for `body: Schema.Schema.Type<typeof Person>`.
  const Person = Schema.Struct({ name: Schema.NonEmptyString })
  // The entry generated for `server/routes/people/[id].controller.ts` under a `_defaults.ts` whose `wrap` maps `Taken`.
  const people: ControllerEntry = {
    route: 'people/[id]',
    pattern: '/people/:id',
    methods: {
      PUT: {
        run: ({ params, body }) =>
          Effect.gen(function* () {
            if (body.name === 'boom') return yield* Effect.die(new Error('secret'))
            if ((yield* Names).taken.has(body.name)) return yield* new Taken({ name: body.name })
            return { id: params.id, name: body.name, extra: 'dropped' }
          }),
        params: Schema.Struct({ id: Schema.String }),
        body: Person,
        success: Schema.Struct({ id: Schema.String, name: Schema.String }),
      },
    },
    options: [
      {
        file: 'server/routes/_defaults.ts',
        wrap: (next) =>
          Effect.catchIf(
            next,
            (e) => e instanceof Taken,
            (e) => Effect.succeed(Response.json({ taken: e.name }, { status: 409 })),
          ),
      },
      { file: 'server/routes/people/[id].controller.ts' },
    ],
  }
  const put = (name: string, path = '/people/7') =>
    new Request(`http://x.test${path}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  const read = async (res: Response) => [res.status, res.headers.get('content-type'), await res.text()]

  it.each([
    ['success, encoded through the success Schema', 'grace', 200],
    ['a decode failure the referenced Schema reports', '', 400],
    ['a failure the directory wrap maps', 'ada', 409],
  ])('%s answers as start(...).fetch does', async (_, name, status) => {
    const viaStart = await read(await start({ controllers: [people], layer }).fetch(put(name)))
    const viaCall = await read(await callController(people, put(name), { layer }))
    expect(viaCall).toEqual(viaStart)
    expect(viaCall[0]).toBe(status)
  })

  it('a URL the pattern does not match is 404; a defect is an empty 500 whose cause reaches onError', async () => {
    expect((await callController(people, put('grace', '/people/7/photos'), { layer })).status).toBe(404)
    let defect: Cause.Cause<unknown> | undefined
    const boom = await callController(people, put('boom'), { layer, onError: (cause) => void (defect = cause) })
    expect(await read(boom)).toEqual([500, null, ''])
    expect(defect && Cause.squash(defect)).toEqual(new Error('secret'))
  })
})

describe('callController over a class Controller entry', () => {
  class Viewer extends Context.Tag('Viewer')<Viewer, string>() {}
  class Greet extends Controller({ viewer: Viewer }) {
    *GET(input: { readonly params: { readonly name: string } }): Gen<string> {
      return `${this.viewer} greets ${input.params.name}`
    }
  }
  // The entry generated for a class Controller file, under a `_defaults.ts` whose `wrap` provides the declared viewer.
  const greet = (wrapped: boolean): ControllerEntry => ({
    route: 'greet/[name]',
    pattern: '/greet/:name',
    methods: { GET: { run: Greet.run('GET'), params: Schema.Struct({ name: Schema.String }), success: Schema.String } },
    options: [
      { file: 'server/_defaults.ts', wrap: wrapped ? (next) => Effect.provideService(next, Viewer, 'ann') : undefined },
    ],
  })
  const get = new Request('http://x.test/greet/bo')

  it('runs the method on an instance built with the viewer the wrap provides; a missing one reaches onError', async () => {
    const ok = await callController(greet(true), get, { layer })
    expect([ok.status, await ok.text()]).toEqual([200, '"ann greets bo"'])
    let defect: Cause.Cause<unknown> | undefined
    const missing = await callController(greet(false), get, { layer, onError: (cause) => void (defect = cause) })
    expect(missing.status).toBe(500)
    expect(defect && Cause.isDie(defect)).toBe(true)
  })
})

describe('callService over a generated entry, in an app with a discovered app', () => {
  // A Layer File: counts its builds.
  class Store extends Context.Tag('Store')<Store, { readonly build: number }>() {}
  let builds = 0
  const StoreLive = Layer.effect(
    Store,
    Effect.sync(() => ({ build: ++builds })),
  )
  const methods = {
    count: ({ by }: { readonly by: number }): Effect.Effect<number, Taken, Store> =>
      by < 0 ? Effect.fail(new Taken({ name: 'negative' })) : Effect.map(Store, (s) => s.build + by),
  }
  const generated = (key: string, file: string): DiscoveredService => {
    class Tag extends Context.Tag(key)<Tag, GeneratedServiceShape<typeof methods>>() {}
    return {
      entry: {
        tag: Tag,
        methods: {
          count: {
            input: Schema.Struct({ by: Schema.Number }),
            success: Schema.Number,
            error: taggedError(Taken, { name: Schema.String }),
          },
        },
      },
      layer: serviceLayer(Tag, methods),
      options: [{ file }],
    }
  }
  const rpcFile = generated('Tally', 'server/tally.rpc.ts')
  const manifest = generated('Counter', 'server/rpc.ts')
  const sunk: Cause.Cause<unknown>[] = []

  afterEach(() => {
    discovered.app = undefined
    builds = 0
    sunk.length = 0
  })

  const discover = () =>
    (discovered.app = {
      controllers: [],
      layer: StoreLive,
      services: [rpcFile, manifest],
      onError: (cause) => void sunk.push(cause),
    })
  // The entry as a test reads it from `virtual:sleek/server-registry`.
  const entryOf = (service: DiscoveredService) =>
    service.entry as ServerServiceEntry<unknown, GeneratedServiceShape<typeof methods>>

  it.each([
    ['an RPC File', rpcFile],
    ['the RPC Manifest', manifest],
  ])('over %s entry, the test layer replaces the Tag and the entry registers once', async (_, service) => {
    discover()
    const entry = entryOf(service)
    const fake = Layer.succeed(entry.tag as Context.Tag<unknown, GeneratedServiceShape<typeof methods>>, {
      count: ({ by }) => Effect.succeed(-by),
    })
    expect(await callService(entry, 'count', { by: 2 }, { layer: fake })).toEqual(Exit.succeed(-2))
    // The Layer Files are still built under the test layer.
    expect(builds).toBe(1)
    // The generated implementation over the test's own Store: a Tag the test layer provides wins over the Layer File.
    const store = Layer.succeed(Store, { build: 40 })
    expect(await callService(entry, 'count', { by: 2 }, { layer: store as never })).toEqual(Exit.succeed(42))
    expect(failure(await callService(entry, 'count', { by: -1 }, { layer: store as never }))).toBeInstanceOf(Taken)
  })

  it("a defect is the Exit's cause, never the Server Root's onError", async () => {
    discover()
    const entry = entryOf(rpcFile)
    const dying = Layer.succeed(entry.tag as Context.Tag<unknown, GeneratedServiceShape<typeof methods>>, {
      count: () => Effect.die(new Error('secret')),
    })
    const exit = await callService(entry, 'count', { by: 1 }, { layer: dying })
    expect([Exit.isFailure(exit) && Cause.squash(exit.cause), sunk.length]).toEqual([new Error('secret'), 0])
  })

  it('the hand-written entry beside the discovered app is unchanged', async () => {
    discover()
    expect(await callService(profiles, 'rename', { name: 'grace' }, { layer: profilesLayer })).toEqual(
      Exit.succeed({ name: 'grace' }),
    )
  })
})
