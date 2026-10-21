import { action, type NotFound, type Redirect } from '@sleekstack/router'
import { type FormAction, useAction } from '@sleekstack/ui'
import { Context, type Effect, type Layer, Schema } from 'effect'
import { client, type DecodeError, type NetworkError, serverClients, ServerService } from '../client'
import { serverFn, type ServerServiceEntry } from '../index'

class Db extends Context.Tag('Db')<Db, { readonly count: number }>() {}
class Full extends Schema.TaggedError<Full>()('Full', { max: Schema.Number }) {}

const addItem = {
  id: 'items.add',
  input: Schema.Struct({ title: Schema.String, at: Schema.DateFromString }),
  success: Schema.Struct({ count: Schema.Number }),
  error: Full,
}
const addItemFn = serverFn(
  addItem.id,
  addItem,
)(function* () {
  return { count: (yield* Db).count }
})
const ping = serverFn('ping', { input: Schema.Void, success: Schema.Void })(function* () {})

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const same = <A, B>(_: Same<A, B>) => {}

// From the contract the browser imports, or the server function itself: the same types, no requirements.
type Expected = Effect.Effect<
  { readonly count: number },
  Full | NetworkError | DecodeError | Redirect | NotFound,
  never
>
same<ReturnType<ReturnType<typeof client<typeof addItem>>>, Expected>(true)
same<ReturnType<ReturnType<typeof client<typeof addItemFn>>>, Expected>(true)
// The input is the server declaration's decoded Type (the wrong-input cases are below).
const fromServer: (input: { readonly title: string; readonly at: Date }) => Expected = client(addItemFn)

// No declared error: only the wire's own failures.
same<
  Effect.Effect.Error<ReturnType<ReturnType<typeof client<typeof ping>>>>,
  NetworkError | DecodeError | Redirect | NotFound
>(true)
client(ping)()

const add = client(addItem)
add({ title: 'milk', at: new Date() })
// @ts-expect-error the input's Type, not its encoded form
add({ title: 'milk', at: '2026-10-17' })
// @ts-expect-error a missing field
add({ title: 'milk' })

// A form action as it stands: its FormData is decoded with the input Schema.
const asForm: FormAction = add
action(add)
useAction(add)

// `serverClients` provides exactly the entries' Tags.
class Profiles extends ServerService('Profiles')<Profiles, { readonly count: () => Effect.Effect<number> }>() {}
class Items extends ServerService('Items')<Items, { readonly list: () => Effect.Effect<ReadonlyArray<string>> }>() {}
declare const profiles: ServerServiceEntry<Profiles, Profiles['Type']>
declare const items: ServerServiceEntry<Items, Items['Type']>
same<ReturnType<typeof serverClients<[typeof profiles, typeof items]>>, Layer.Layer<Profiles | Items>>(true)
same<ReturnType<typeof serverClients<[typeof profiles]>>, Layer.Layer<Profiles>>(true)
const both: Layer.Layer<Profiles | Items> = serverClients([profiles, items])
// @ts-expect-error a Layer providing only Profiles does not provide Items
const missing: Layer.Layer<Profiles | Items> = serverClients([profiles])
