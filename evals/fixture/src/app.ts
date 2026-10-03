import { configureRuntime } from '@sleekstack/kit/next'
import { Data } from './data'

configureRuntime({ provide: [Data] })
