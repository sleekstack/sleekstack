import { Context, Effect, Layer } from 'effect'
import { expectTypeOf } from 'vitest'
import { service, type CaptiveViolations } from '../service'

class A extends Context.Tag('A')<A, { a: number }>() {}
class B extends Context.Tag('B')<B, { b: string }>() {}
class C extends Context.Tag('C')<C, boolean>() {}

const CDef = service(C, { requires: [A, B] }, (deps) => {
  // `requires` drives the deps tuple, in order
  expectTypeOf(deps).toEqualTypeOf<readonly [{ a: number }, { b: string }]>()
  return Effect.fail('boom' as const).pipe(Effect.as(true))
})
// ...and the Layer requirement type; make's error becomes the Layer error
expectTypeOf(CDef.layer).toEqualTypeOf<Layer.Layer<C, 'boom', A | B>>()

const ADef = service(A, {}, () => Effect.succeed({ a: 1 }))
expectTypeOf(ADef.layer).toEqualTypeOf<Layer.Layer<A, never, never>>()

// @ts-expect-error make must return the Tag's service shape
service(A, {}, () => Effect.succeed({ a: 'x' }))

const RDef = service(B, { requires: [A], lifetime: 'request' }, () => Effect.succeed({ b: '' }))
const AppOnB = service(C, { requires: [B] }, () => Effect.succeed(true))
expectTypeOf<CaptiveViolations<[typeof ADef, typeof RDef, typeof AppOnB]>>().toEqualTypeOf<'C (app) captures B (request)'>()
