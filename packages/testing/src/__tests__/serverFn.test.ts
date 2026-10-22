import { NotFound, Redirect, redirect } from '@sleekstack/router'
import {
  type ControllerEntry,
  Cookies,
  DecodeError,
  implement,
  serverFn,
  ServerService,
  type ServerServiceEntry,
  type ServerServiceEntryOf,
  start,
  taggedError,
} from '@sleekstack/start'
import { Cause, Context, Data, Effect, Exit, Layer, Option, Schema } from 'effect'
import { describe, expect, it } from 'vitest'
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
