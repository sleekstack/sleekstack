import { Context, Effect, Layer } from 'effect'
import { declareLayer, module } from '@sleekstack/core'
class A extends Context.Tag('A')<A, string>() {}
class B extends Context.Tag('B')<B, string>() {}
export const App = module({
  name: 'App',
  entries: [
    declareLayer(Layer.succeed(A, 'r' as never), { lifetime: 'request' }),
    declareLayer(Layer.effect(B, Effect.as(A, 'b' as never))), // @error CaptiveDependency
  ],
})
