import { layer, module, tag } from '@sleekstack/kit'
const A = tag<string>('A')
const B = tag<string>('B')
const X1 = module({ name: 'X', provide: [layer(A, () => 'x1')] })
const X2 = module({ name: 'X', provide: [layer(B, () => 'x2')] }) // @error DuplicateModule
export const App = module({ name: 'App', imports: [X1, module({ name: 'Y', imports: [X2] })] })
