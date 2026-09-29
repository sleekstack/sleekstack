import { effect, layer, module, tag } from '@sleekstack/kit'

declare const name: string
const Dynamic = tag<object>(name)
const Clock = tag<object>('Clock')
const makeLayers = () => [layer(Clock, {})]

export const App = module({
  name: 'App',
  provide: makeLayers(),
  exports: [Dynamic],
})

const grown = [layer(Clock, {})]
grown.push(layer(Dynamic, {}))
let swapped = [layer(Clock, {})]
swapped = []

export const Mutated = module({ name: 'Mutated', provide: grown })
export const Rebound = module({ name: 'Rebound', provide: swapped })
export const Unnamed = module({ name: 'Unnamed', provide: [effect(() => {})] })
