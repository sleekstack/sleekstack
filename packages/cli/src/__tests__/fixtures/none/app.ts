import { Context, Layer } from 'effect'
import { declareLayer, module } from '@sleekstack/core'
class A extends Context.Tag('A')<A, string>() {}
export const App = module({ name: 'App', entries: [declareLayer(Layer.succeed(A, 'a'))] })
