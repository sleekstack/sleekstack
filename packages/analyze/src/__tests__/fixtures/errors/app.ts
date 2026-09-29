import { layer, module, tag } from '@sleekstack/kit'

declare const name: string
const Dynamic = tag<object>(name)
const Clock = tag<object>('Clock')
const makeLayers = () => [layer(Clock, {})]

export const App = module({
  name: 'App',
  provide: makeLayers(),
  exports: [Dynamic],
})
