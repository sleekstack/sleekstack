import { Data, Effect } from 'effect'
import { expectTypeOf } from 'vitest'
import type { QueryClientTag } from '@sleekstack/query'
import { Catch, el, type Node, type Store } from '../index'
import { type QueryFailed, useSuspenseQuery } from '../query'

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

// useSuspenseQuery: E is QueryFailed (an unprovided client is a compile-time R error), R is the query client and Store
expectTypeOf(useSuspenseQuery({ queryKey: ['k'], queryFn: async () => 1 })).toEqualTypeOf<
  Effect.Effect<number, QueryFailed, QueryClientTag | Store>
>()
// @ts-expect-error a disabled query never resolves
useSuspenseQuery({ queryKey: ['k'], queryFn: async () => 1, enabled: false })
