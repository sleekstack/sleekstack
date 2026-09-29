import { layer, module, tag } from '@sleekstack/kit'
import { configureRuntime } from '@sleekstack/kit/next'
const A = tag<string>('A')
const B = tag<string>('B')
configureRuntime({ provide: [module({ name: 'Bad', provide: [layer(B, (a) => a, [A])] })] })
