import { Atom } from '@sleekstack/core'
import type { Status } from './domain'

/** The project on screen. */
export const projectAtom = Atom.make('p1')

/** Which status column the board shows; `all` shows every column. */
export const filterAtom = Atom.make<Status | 'all'>('all')

/** The task open in the detail panel, if any. */
export const selectedAtom = Atom.make<string | null>(null)
