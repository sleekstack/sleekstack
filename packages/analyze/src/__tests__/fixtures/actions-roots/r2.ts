import { layer } from '@sleekstack/kit'
import { configureRuntime } from '@sleekstack/kit/next'
import { Y } from './a2'
configureRuntime({ provide: [layer(Y, 'y')] })
