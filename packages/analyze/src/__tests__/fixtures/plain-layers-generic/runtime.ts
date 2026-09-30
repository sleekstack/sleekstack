import { configureRuntime } from '@sleekstack/kit/next'
import { AppLive } from './live'

configureRuntime({ layer: AppLive } as never)
