import { layer, tag } from '@sleekstack/kit'

export interface Tally { get(): number; bump(): void; subscribe(l: () => void): () => void }
const makeTally = (): Tally => {
  let n = 0
  const ls = new Set<() => void>()
  return { get: () => n, bump: () => { n++; ls.forEach((l) => l()) }, subscribe: (l) => (ls.add(l), () => void ls.delete(l)) }
}
export const Shared = tag<Tally>('Shared')
export const Local = tag<Tally>('Local')
/** App scope: one instance per registry per page. */
export const SharedLayer = layer(Shared, makeTally)
/** Component scope: one instance per Island. */
export const LocalLayer = layer(Local, makeTally, [], { lifetime: 'component' })
