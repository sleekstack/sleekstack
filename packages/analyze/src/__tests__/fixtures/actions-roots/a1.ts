import { tag } from '@sleekstack/kit'
import { query } from '@sleekstack/kit/next'
export const X = tag<string>('X')
export const one = () => query(function* () { return yield* X })
