import { type ActionEvent, defineHandler, Store } from '@sleekstack/ui'
import { Effect } from 'effect'
import { countAtom } from './count'

/** The counter form's action, loaded lazily by the resume entry on the first submit. */
export default defineHandler('set', (e: ActionEvent) =>
  Effect.flatMap(Store, (s) => Effect.sync(() => s.set(countAtom, Number(e.formData.get('to'))))),
)
