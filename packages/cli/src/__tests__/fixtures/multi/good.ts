import { layer, module, tag } from '@sleekstack/kit'
import { configureRuntime } from '@sleekstack/kit/next'
const A = tag<string>('A')
configureRuntime({ provide: [module({ name: 'Good', provide: [layer(A, () => 'a')] })] })
