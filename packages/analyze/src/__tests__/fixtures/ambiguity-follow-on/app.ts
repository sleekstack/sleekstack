import { Context, Effect, Layer } from 'effect'
import { declareLayer, module } from '@sleekstack/core'
class A extends Context.Tag('A')<A, string>() {}
class B extends Context.Tag('B')<B, string>() {}
class M extends Context.Tag('M')<M, string>() {}
class Z extends Context.Tag('Z')<Z, string>() {}
// A is ambiguous: one provider is request-scoped, so judging through either would be order-dependent.
const L1 = module({ name: 'L1', entries: [declareLayer(Layer.succeed(A, '1' as never), { lifetime: 'request' })] })
const L2 = module({ name: 'L2', entries: [declareLayer(Layer.succeed(A, '2' as never))] })
const Lib = module({ name: 'Lib', entries: [declareLayer(Layer.effect(B, Effect.as(Z, 'b')).pipe(Layer.merge(Layer.succeed(M, 'm'))))] })
export const App = module({
  name: 'App',
  imports: [L1, L2, Lib],
  entries: [declareLayer(Layer.effect(M, Effect.as(A, 'm' as never)))],
})
