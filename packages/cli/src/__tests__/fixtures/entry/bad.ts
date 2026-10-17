import { Context, Effect, Layer } from 'effect'
import { declareLayer, module } from '@sleekstack/core'
import { configureRuntime } from '@sleekstack/runtime'
class A extends Context.Tag('A')<A, string>() {}
class B extends Context.Tag('B')<B, string>() {}
configureRuntime({ provide: [module({ name: 'Bad', entries: [declareLayer(Layer.effect(B, Effect.as(A, 'b')))] })] })
