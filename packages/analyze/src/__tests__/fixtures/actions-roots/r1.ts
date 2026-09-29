import { layer } from '@sleekstack/kit'
import { configureRuntime } from '@sleekstack/kit/next'
import { X } from './a1'
configureRuntime({ provide: [layer(X, 'x')] })
