import { Atom } from '@sleekstack/core'
import { Schema } from 'effect'

// Serializable: the server manifest carries its value, so `resume` seeds it without running a component.
export const countAtom = Atom.serializable(Atom.make(0), { key: 'count', schema: Schema.Number })
