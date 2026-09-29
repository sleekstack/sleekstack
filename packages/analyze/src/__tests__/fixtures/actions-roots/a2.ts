import { tag } from '@sleekstack/kit'
import { query } from '@sleekstack/kit/next'
export const Y = tag<string>('Y')
export const two = () => query(function* () { return yield* Y })
