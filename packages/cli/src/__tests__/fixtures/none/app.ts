import { layer, module, tag } from '@sleekstack/kit'
const A = tag<string>('A')
export const App = module({ name: 'App', provide: [layer(A, () => 'a')] })
