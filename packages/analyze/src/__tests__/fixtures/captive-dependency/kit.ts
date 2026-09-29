import { layer, module, tag } from '@sleekstack/kit'
const A = tag<string>('A')
const B = tag<string>('B')
export const App = module({
  name: 'App',
  provide: [
    layer(A, () => 'r', [], { lifetime: 'request' }),
    layer(B, (a) => a, [A]), // @error CaptiveDependency
  ],
})
