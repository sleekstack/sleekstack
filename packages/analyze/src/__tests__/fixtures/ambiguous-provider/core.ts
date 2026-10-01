import { Context, Effect, Layer } from 'effect'
import { declareLayer, module } from '@sleekstack/core'
class A extends Context.Tag('A')<A, string>() {}
class B extends Context.Tag('B')<B, string>() {}
const L1 = module({ name: 'L1', entries: [declareLayer(Layer.succeed(A, 'l1' as never))] })
const L2 = module({ name: 'L2', entries: [declareLayer(Layer.succeed(A, 'l2' as never))] }) // @error AmbiguousProvider
export const App = module({ name: 'App', imports: [L1, L2] })
