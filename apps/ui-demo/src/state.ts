import { Atom } from '@sleekstack/core'
import type { Status } from './domain'

/** Which status column the board shows; `all` shows every column. */
export const filterAtom = Atom.make<Status | 'all'>('all')

/** The task shown in the detail panel. */
export const selectedAtom = Atom.make('t2')
