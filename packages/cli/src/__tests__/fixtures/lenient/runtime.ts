import { Context, Layer } from 'effect'
import { configureRuntime, runEffect } from '@sleekstack/runtime'

class A extends Context.Tag('A')<A, string>() {}

configureRuntime({ layer: Layer.succeed(A, 'a') })

const Untyped: any = {}
export const run = () => runEffect(undefined as never, { request: Untyped })
