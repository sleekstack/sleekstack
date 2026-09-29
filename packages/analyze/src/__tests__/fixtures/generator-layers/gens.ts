import { tag } from '@sleekstack/kit'
export const R = tag<string>('R')
export function* readsR() {
  return yield* R
}
