import { module } from '@sleekstack/core'
export const Top = module({ name: 'Top', imports: () => [Mid] }) // @error ModuleCycle
const Mid = module({ name: 'Mid', imports: [Top] })
