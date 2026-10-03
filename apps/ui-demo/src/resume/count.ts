import { Atom } from '@sleekstack/core'
import { Schema } from 'effect'

/** The counter's value; serializable so the server manifest seeds it on resume. */
export const countAtom = Atom.serializable(Atom.make(0), { key: 'count', schema: Schema.Number })
