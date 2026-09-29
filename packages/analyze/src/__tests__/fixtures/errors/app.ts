import { effect, layer, module, tag } from '@sleekstack/kit'

declare const name: string
const Dynamic = tag<object>(name)
const Clock = tag<object>('Clock')
const makeLayers = (): any[] => [layer(Clock, {})]

export const App = module({
  name: 'App',
  provide: makeLayers(),
  exports: [Dynamic],
})

declare function register(xs: unknown[]): void
const escaped = [layer(Clock, {})]
register(escaped)
let swapped = [layer(Clock, {})]
swapped = []

export const Escaped = module({ name: 'Escaped', provide: escaped })
export const Rebound = module({ name: 'Rebound', provide: swapped })
export const Unnamed = module({ name: 'Unnamed', provide: [effect(() => {})] })
