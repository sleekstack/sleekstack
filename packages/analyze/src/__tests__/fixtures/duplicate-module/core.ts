import { Context, Effect, Layer } from 'effect'
import { declareLayer, module } from '@sleekstack/core'
class A extends Context.Tag('A')<A, string>() {}
class B extends Context.Tag('B')<B, string>() {}
const X1 = module({ name: 'X', entries: [declareLayer(Layer.succeed(A, 'x1' as never))] })
const X2 = module({ name: 'X', entries: [declareLayer(Layer.succeed(B, 'x2' as never))] }) // @error DuplicateModule
export const App = module({ name: 'App', imports: [X1, module({ name: 'Y', imports: [X2] })] })
