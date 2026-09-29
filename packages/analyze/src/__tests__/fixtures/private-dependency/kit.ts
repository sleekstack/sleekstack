import { layer, module, tag } from '@sleekstack/kit'
const A = tag<string>('A')
const B = tag<string>('B')
const C = tag<string>('C')
const Lib = module({ name: 'Lib', provide: [layer(A, 'secret'), layer(B, (a) => a, [A])], exports: [B] })
export const App = module({ name: 'App', imports: [Lib], provide: [layer(C, (a) => a, [A])] }) // @error PrivateDependency
