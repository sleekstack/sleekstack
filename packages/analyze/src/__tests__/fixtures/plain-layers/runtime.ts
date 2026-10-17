import { configureRuntime } from '../../../../../runtime/src/index'
import { AppLive } from './live'

configureRuntime({ layer: AppLive } as never)
