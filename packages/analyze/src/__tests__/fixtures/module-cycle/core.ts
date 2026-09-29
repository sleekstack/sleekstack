import { module } from '@sleekstack/core'
const CycleA = module({ name: 'CycleA', imports: () => [CycleB] }) // @error ModuleCycle
const CycleB = module({ name: 'CycleB', imports: [CycleA] })
export const App = module({ name: 'App', imports: [CycleA] })
