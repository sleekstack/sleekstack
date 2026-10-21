import { NotFound, Redirect, redirect } from '@sleekstack/router'
import {
  Cookies,
  DecodeError,
  serverFn,
  ServerService,
  type ServerServiceEntry,
  type ServerServiceEntryOf,
  taggedError,
} from '@sleekstack/start'
import { Cause, Context, Data, Effect, Exit, Layer, Option, Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import { callHandler, callServerFn, callService } from '../index'

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
