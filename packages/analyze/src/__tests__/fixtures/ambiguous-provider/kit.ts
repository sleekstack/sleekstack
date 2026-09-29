import { layer, module, tag } from '@sleekstack/kit'
const A = tag<string>('A')
const B = tag<string>('B')
const L1 = module({ name: 'L1', provide: [layer(A, () => 'l1')] })
const L2 = module({ name: 'L2', provide: [layer(A, () => 'l2')] }) // @error AmbiguousProvider
export const App = module({ name: 'App', imports: [L1, L2] })
