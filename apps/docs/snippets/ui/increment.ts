import { Effect } from 'effect'
import { defineHandler, Store } from '@sleekstack/ui'
import { countAtom } from './count'

// The handler's own module, loaded on the first click. The id is a literal; the server emits only the id.
export default defineHandler('increment', () =>
  Effect.flatMap(Store, (store) => Effect.sync(() => store.update(countAtom, (n) => n + 1))),
)
