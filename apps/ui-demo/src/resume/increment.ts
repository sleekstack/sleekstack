import { defineHandler, Store } from '@sleekstack/ui'
import { Effect } from 'effect'
import { countAtom } from './count'

/** Loaded lazily by the resume entry on the first click. */
export default defineHandler('increment', () => Effect.flatMap(Store, (s) => Effect.sync(() => s.update(countAtom, (n) => n + 1))))
