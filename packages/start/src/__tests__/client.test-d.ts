import type { NotFound, Redirect } from '@sleekstack/router'
import { Context, type Effect, Schema } from 'effect'
import { client, type DecodeError, type NetworkError } from '../client'
import { serverFn } from '../index'

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
same<Parameters<ReturnType<typeof client<typeof addItemFn>>>[0], { readonly title: string; readonly at: Date }>(true)

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
