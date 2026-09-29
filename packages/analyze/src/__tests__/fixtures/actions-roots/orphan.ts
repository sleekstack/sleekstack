import { query } from '@sleekstack/kit/next'
import { X } from './a1'
export const orphan = () => query(function* () { return yield* X }, [X]) // @error UnownedAction
