import { Layer } from 'effect'
import { configureRuntime } from '../../../../../runtime/src/index'
import { StoreLive } from './live'

const Untyped: any = StoreLive
configureRuntime({ layer: Layer.mergeAll(StoreLive, Untyped) } as never) // @error Computed
