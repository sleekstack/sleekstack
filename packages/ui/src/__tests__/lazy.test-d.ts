import { Context, Data, Effect } from 'effect'
import { expectTypeOf } from 'vitest'
import { el, lazy, type LazyLoadError, type Node } from '../index'

lazy(async () => ({ default: (p: { n: string }) => Effect.succeed(el('b', {}, p.n)) }))
// @ts-expect-error a default export that is not a component is rejected
lazy(async () => ({ default: () => 123 }))

class Db extends Context.Tag('Db')<Db, number>() {}
class Boom extends Data.TaggedError('Boom') {}
// The loaded component's errors and requirements survive, next to LazyLoadError.
const Typed = lazy(async () => ({ default: () => Effect.as(Effect.zip(Db, Effect.fail(new Boom())), el('b', {})) }))
expectTypeOf(Typed({})).toEqualTypeOf<Effect.Effect<Node, Boom | LazyLoadError, Db>>()
const Gen = lazy(async () => ({
  default: function* () {
    yield* Db
    return el('b', {})
  },
}))
expectTypeOf(Gen({})).toEqualTypeOf<Effect.Effect<Node, LazyLoadError, Db>>()
