import { Context, Effect, Layer } from 'effect'
import { declareLayer, module, service } from '@sleekstack/core'
const A = Context.GenericTag<string>('A')
const B = Context.GenericTag<string>('B')
const M = Context.GenericTag<string>('M')
const Z = Context.GenericTag<string>('Z')
// A is ambiguous: one provider is request-scoped, so judging through either would be order-dependent.
const L1 = module({ name: 'L1', entries: [service(A, { lifetime: 'request' }, () => Effect.succeed('1'))] })
const L2 = module({ name: 'L2', entries: [service(A, {}, () => Effect.succeed('2'))] })
const Lib = module({ name: 'Lib', entries: [declareLayer(Layer.succeed(B, 'b').pipe(Layer.merge(Layer.succeed(M, 'm'))), { provides: [B, M], requires: [Z] })] })
export const App = module({
  name: 'App',
  imports: [L1, L2, Lib],
  entries: [service(M, { requires: [A] }, () => Effect.succeed('m'))],
})
