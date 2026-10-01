import { Context, Effect, Layer } from 'effect'
import { declareLayer, module } from '@sleekstack/core'
class A extends Context.Tag('A')<A, string>() {}
class B extends Context.Tag('B')<B, string>() {}
class C extends Context.Tag('C')<C, string>() {}
const Lib = module({ name: 'Lib', entries: [declareLayer(Layer.succeed(A, 's' as never)), declareLayer(Layer.effect(B, Effect.as(A, 'b' as never)))], exports: [B] })
export const App = module({ name: 'App', imports: [Lib], entries: [declareLayer(Layer.effect(C, Effect.as(A, 'c' as never)))] }) // @error PrivateDependency
