import { Context, Effect, Layer } from 'effect'
import { configureRuntime } from '@sleekstack/runtime'
class A extends Context.Tag('A')<A, string>() {}
class B extends Context.Tag('B')<B, string>() {}
// A is never provided (the defect under test); `as never` keeps the fixture compiling.
configureRuntime({ layer: Layer.effect(B, Effect.as(A, 'b')) } as never)
