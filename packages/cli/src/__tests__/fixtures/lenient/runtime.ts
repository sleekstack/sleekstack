import { Context, Layer } from 'effect'
import { declareLayer, module } from '@sleekstack/core'
import { configureRuntime, runEffect } from '@sleekstack/runtime'

class A extends Context.Tag('A')<A, string>() {}
configureRuntime({ provide: [module({ name: 'App', entries: [declareLayer(Layer.succeed(A, 'a'))] })] })

const Untyped: any = {}
export const run = () => runEffect(undefined as never, { request: Untyped })
