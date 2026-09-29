import { module } from '@sleekstack/kit'
export const Top = module({ name: 'Top', imports: () => [Mid] }) // @error ModuleCycle
const Mid = module({ name: 'Mid', imports: [Top] })
