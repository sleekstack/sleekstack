import { Data, Effect } from 'effect'
import { expectTypeOf } from 'vitest'
import { Catch, el, type Node } from '../index'

class ErrA extends Data.TaggedError('A')<{ readonly a: number }> {}
class ErrB extends Data.TaggedError('B')<{ readonly b: string }> {}

declare const both: Effect.Effect<Node, ErrA | ErrB, never>

// catching A leaves exactly B; the handler sees only A
const onlyB = Catch(
  'A',
  (e) => {
    expectTypeOf(e).toEqualTypeOf<ErrA>()
    return el('p', {}, String(e.a))
  },
  both,
)
expectTypeOf(onlyB).toEqualTypeOf<Effect.Effect<Node, ErrB, never>>()

// catching every tag leaves never
const none = Catch('B', () => el('p'), onlyB)
expectTypeOf(none).toEqualTypeOf<Effect.Effect<Node, never, never>>()

// @ts-expect-error C is not in E
Catch('C', () => el('p'), both)
Catch('B', () => el('p'), both)
