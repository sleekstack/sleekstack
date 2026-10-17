import { Context, Layer } from 'effect'
import { declareLayer, module } from '@sleekstack/core'
import { configureRuntime } from '@sleekstack/runtime'
class A extends Context.Tag('A')<A, string>() {}
configureRuntime({ provide: [module({ name: 'Good', entries: [declareLayer(Layer.succeed(A, 'a'))] })] })
