import { Atom } from '@sleekstack/core'
import { Effect, Schema } from 'effect'

const User = Schema.Struct({ id: Schema.String, name: Schema.String })
const loadUser = Effect.succeed({ id: 'u1', name: 'Ada' })

// Value kind: the schema describes the atom's value.
export const greeting = Atom.serializable(Atom.make('hello'), { key: 'app/greeting', schema: Schema.String })

// Result kind: the atom's value is `Result<A, E>`; the schema describes the `Success` value `A`.
export const user = Atom.serializable.result(Atom.make(loadUser), { key: 'app/user', schema: User })
