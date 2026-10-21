import { router, routes } from '@sleekstack/router'
import { el } from '@sleekstack/ui'
import { Context, Data, Effect, Layer, Schema } from 'effect'
import type { DecodeError, NetworkError } from '../client'
import { ServerService, type ServerServiceEntry, start } from '../index'

class NameTaken extends Data.TaggedError('NameTaken')<{ readonly name: string }> {}
class Db extends Context.Tag('Db')<Db, { readonly taken: string }>() {}

class Profiles extends ServerService('Profiles')<
  Profiles,
  { readonly rename: (input: { readonly name: string }) => Effect.Effect<{ readonly name: string }, NameTaken> }
>() {}

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const same = <A, B>(_: Same<A, B>) => {}

// `yield* Profiles` methods carry the wire errors, so a page handles one error type in both environments.
Effect.gen(function* () {
  const profiles = yield* Profiles
  const renamed = profiles.rename({ name: 'ada' })
  same<typeof renamed, Effect.Effect<{ readonly name: string }, NameTaken | NetworkError | DecodeError>>(true)
})

// An implementation typed with the narrow contract errors, and its own server-only services, is assignable.
const narrow: (input: { readonly name: string }) => Effect.Effect<{ readonly name: string }, NameTaken, never> = (
  input,
) => Effect.succeed(input)
const layer: Layer.Layer<Profiles, never, Db> = Layer.effect(
  Profiles,
  Effect.map(Db, () => ({ rename: narrow })),
)
const provided = Layer.provide(layer, Layer.succeed(Db, { taken: '' }))

// @ts-expect-error a contract method needs no services
ServerService('Needs')<never, { readonly go: () => Effect.Effect<void, never, Db> }>()

const entry: ServerServiceEntry<Profiles, Profiles['Type']> = {
  tag: Profiles,
  methods: {
    rename: { input: Schema.Struct({ name: Schema.String }), success: Schema.Struct({ name: Schema.String }) },
  },
}
// @ts-expect-error an entry has Schemas for every method
const missing: ServerServiceEntry<Profiles, Profiles['Type']> = { tag: Profiles, methods: {} }

const app = router({
  table: routes({ home: '/' }),
  pages: { home: { render: () => Effect.succeed(el('p', {}, 'home')) } },
  notFound: () => Effect.succeed(el('p', {}, 'missing')),
})
start({ router: app, layer: provided, services: [entry] })
// @ts-expect-error the layer must provide the Tag
start({ router: app, services: [entry] })
// @ts-expect-error a layer without the Tag
start({ router: app, layer: Layer.succeed(Db, { taken: '' }), services: [entry] })

// A registry of several Tags needs each one: `services` is read per entry, not inferred as the first Tag.
class Accounts extends ServerService('Accounts')<Accounts, { readonly count: () => Effect.Effect<number> }>() {}
const accounts: ServerServiceEntry<Accounts, Accounts['Type']> = {
  tag: Accounts,
  methods: { count: { input: Schema.Void, success: Schema.Number } },
}
const accountsLayer = Layer.succeed(Accounts, { count: () => Effect.succeed(1) })
start({ router: app, layer: Layer.merge(provided, accountsLayer), services: [entry, accounts] })
// @ts-expect-error the layer provides only one of the two Tags
start({ router: app, layer: provided, services: [entry, accounts] })
