import { Context, Data, Effect, type Layer } from 'effect'
import { Cookies, implement, Request, ResponseStatus, ServerService } from '../index'

class NameTaken extends Data.TaggedError('NameTaken')<{ readonly name: string }> {}
class Db extends Context.Tag('Db')<Db, { readonly taken: string }>() {}

class Profiles extends ServerService('Profiles')<
  Profiles,
  { readonly rename: (input: { readonly name: string }) => Effect.Effect<{ readonly name: string }, NameTaken> }
>() {}

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const same = <A, B>(_: Same<A, B>) => {}

// Request services and the narrow contract error type-check; the result is the Tag's Layer.
const live = implement(Profiles, {
  rename: (input) =>
    Effect.gen(function* () {
      if ((yield* Cookies).get('session') === undefined) return yield* new NameTaken(input)
      yield* Request
      yield* ResponseStatus.set(201)
      return input
    }),
})
same<typeof live, Layer.Layer<Profiles>>(true)

implement(Profiles, {
  // @ts-expect-error a service outside the request services
  rename: (input) => Effect.as(Db, input),
})
