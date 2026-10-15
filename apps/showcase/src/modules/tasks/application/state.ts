import { Atom } from '@sleekstack/core'
import { Effect } from 'effect'
import { useSetAtom } from '@sleekstack/ui'
import type { Status } from '../domain/model'

/** Which status column the board shows; `all` shows every column. */
export const filterAtom = Atom.make<Status | 'all'>('all')

/** The task open in the detail panel, if any. */
export const selectedAtom = Atom.make<string | null>(null)

/** Clears the open task and the status filter (when the project on screen changes). */
export const useResetTaskView = function* () {
  const select = yield* useSetAtom(selectedAtom)
  const setFilter = yield* useSetAtom(filterAtom)
  return Effect.sync(() => {
    select(null)
    setFilter('all')
  })
}
