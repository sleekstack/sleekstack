import { layer, module, tag } from '@sleekstack/kit'
import { configureRuntime } from '@sleekstack/kit/next'
import { runEffect } from '../../../../../runtime/src/index'

const A = tag<string>('A')
configureRuntime({ provide: [module({ name: 'App', provide: [layer(A, () => 'a')] })] })

const Untyped: any = {}
export const run = () => runEffect(undefined as never, { request: Untyped })
