import { Effect, Schema } from 'effect'
import * as Atom from '../Atom'
import type { Result } from '../Result'

const count = Atom.make(1)
const branded = Atom.serializable(count, { key: 'count', schema: Schema.Number })
const asWritable: Atom.Writable<number> = branded
const asAtom: Atom.Atom<number> = branded
const derived = Atom.serializable(
  Atom.make((get) => get(count) * 2),
  { key: 'double', schema: Schema.Number },
)
const result = Atom.serializable.result(Atom.make(Effect.succeed('x')), { key: 'r', schema: Schema.String })
const asResultAtom: Atom.Atom<Result<string, unknown>> = result

const needsBrand = (_: Atom.Serializable<Atom.Atom<any>>) => {}
needsBrand(branded)
needsBrand(derived)
needsBrand(result)
// @ts-expect-error an unbranded atom is not serializable
needsBrand(count)

// @ts-expect-error a function value has no matching Schema
Atom.serializable(
  Atom.make(() => () => 1),
  { key: 'fn', schema: Schema.Number },
)
// @ts-expect-error the result kind's schema describes the Success value
Atom.serializable.result(Atom.make(Effect.succeed(1)), { key: 'n', schema: Schema.String })

void [asWritable, asAtom, asResultAtom]
