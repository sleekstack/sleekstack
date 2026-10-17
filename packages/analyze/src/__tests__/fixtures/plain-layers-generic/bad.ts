import { Context, Layer } from 'effect'
import { configureRuntime } from '../../../../../runtime/src/index'

interface Shared { readonly n: number }
export const A = Context.GenericTag<Shared>('A')
export const B = Context.GenericTag<Shared>('B')

configureRuntime({ layer: Layer.succeed(A, { n: 1 }) } as never) // @error Computed
