import { Context, Layer } from 'effect'
import { configureRuntime } from '@sleekstack/runtime'
class A extends Context.Tag('A')<A, string>() {}
configureRuntime({ layer: Layer.succeed(A, 'a') })
