import { expectTypeOf } from 'vitest'
import { SleekStackError, type SleekStackErrorCode, type SleekStackErrorDetails } from '../index'

declare const e: unknown
if (e instanceof SleekStackError) {
  expectTypeOf(e.code).toEqualTypeOf<SleekStackErrorCode>()
  if (e.code === 'MissingDependency')
    expectTypeOf(e.details).toEqualTypeOf<SleekStackErrorDetails['MissingDependency']>()
  if (e.code === 'PrivateDependency')
    expectTypeOf(e.details).toEqualTypeOf<{
      readonly tag: string
      readonly module: string
      readonly requiredBy: string
    }>()
  if (e.code === 'DependencyCycle') expectTypeOf(e.details.path).toEqualTypeOf<readonly string[]>()
  if (e.code === 'LayerFailed') expectTypeOf(e.details.cause).toEqualTypeOf<string>()
  if (e.code === 'Unknown') expectTypeOf(e.details).toEqualTypeOf<{}>()
}

// every code narrows details to exactly its own entry
type Narrowed = { [C in SleekStackErrorCode]: Extract<SleekStackError, { code: C }>['details'] }
expectTypeOf<Narrowed>().toEqualTypeOf<SleekStackErrorDetails>()

new SleekStackError('Unknown', 'm')
new SleekStackError('DuplicateTag', 'm', { tag: 'k' })
// @ts-expect-error DuplicateTag requires its details
new SleekStackError('DuplicateTag', 'm')
// @ts-expect-error wrong details for the code
new SleekStackError('DuplicateModule', 'm', { tag: 'k' })
// @ts-expect-error a no-details code takes no fields (nor a primitive)
new SleekStackError('Unknown', 'm', 'x')
// @ts-expect-error a no-details code takes no fields
new SleekStackError('Unknown', 'm', { tag: 'k' })
declare const either: 'DuplicateTag' | 'DuplicateModule'
// @ts-expect-error a union code must not accept one member's details for the other
new SleekStackError(either, 'm', { tag: 'k' })
