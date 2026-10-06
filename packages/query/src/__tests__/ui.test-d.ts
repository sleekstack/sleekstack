import { Effect } from 'effect'
import { expectTypeOf } from 'vitest'
import type { Store } from '@sleekstack/ui'
import type { QueryClientTag } from '../client'
import { type QueryFailed, useSuspenseQuery } from '../ui'

// useSuspenseQuery: E is QueryFailed (an unprovided client is a compile-time R error), R is the query client and Store
expectTypeOf(useSuspenseQuery({ queryKey: ['k'], queryFn: async () => 1 })).toEqualTypeOf<
  Effect.Effect<number, QueryFailed, QueryClientTag | Store>
>()
// @ts-expect-error a disabled query never resolves
useSuspenseQuery({ queryKey: ['k'], queryFn: async () => 1, enabled: false })
