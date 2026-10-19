import type { Atom, Result } from '@sleekstack/core'
import { Context, Data, Effect, type ParseResult, Schema } from 'effect'
import { expectTypeOf } from 'vitest'
import { type BoundAction, type Store, useAction } from '@sleekstack/ui'
import { type DraftSpec, useDraft } from '../index'

type Model = { readonly name: string; readonly age: number }
type Form = { readonly name: string; readonly age: string }
type Body = { readonly id: string; readonly name: string; readonly age: number }
class Ids extends Context.Tag('Ids')<Ids, { readonly next: () => string }>() {}
class Taken extends Data.TaggedError('Taken')<{}> {}

const FormSchema = Schema.Struct({ name: Schema.String, age: Schema.String })
const toDto = (d: Form): Effect.Effect<Body, Taken, Ids> =>
  Effect.map(Ids, (ids) => ({ id: ids.next(), name: d.name, age: Number(d.age) }))

const Blank = { schema: () => FormSchema, create: (): Form => ({ name: '', age: '' }), toDto } satisfies DraftSpec<
  Form,
  Body,
  void,
  never,
  Taken,
  Ids
>
const Edit = {
  schema: () => FormSchema,
  create: (m: Model): Form => ({ name: m.name, age: String(m.age) }),
  toDto,
  toModel: (d: Form, m: Model): Model => ({ name: d.name, age: Number(d.age) || m.age }),
  diff: (_: Form, next: Form): Partial<Body> => ({ name: next.name }),
} satisfies DraftSpec<Form, Body, Model, Model, Taken, Ids>

// R1: the schema's Type and Encoded are both the Draft: a coercing schema is rejected
const Coerced = {
  // @ts-expect-error Encoded `{ age: string }` is not the Type `{ age: number }`
  schema: () => Schema.Struct({ name: Schema.String, age: Schema.NumberFromString }),
  create: (): Form => ({ name: '', age: '' }),
  toDto,
} satisfies DraftSpec<Form, Body, void, never, Taken, Ids>
void Coerced
const coercing = { ...Blank, schema: () => Schema.Struct({ name: Schema.String, age: Schema.NumberFromString }) }
// @ts-expect-error an unannotated spec with a coercing schema is rejected by useDraft too
void useDraft(coercing, undefined)

const Note = { schema: () => Schema.String, create: () => '', toDto: Effect.succeed } satisfies DraftSpec<
  string,
  string
>
const When = {
  schema: () => Schema.DateFromSelf,
  create: () => new Date(0),
  toDto: Effect.succeed,
} satisfies DraftSpec<Date, Date>
class Point {
  constructor(
    readonly x: number,
    readonly y: number,
  ) {}
  norm() {
    return Math.hypot(this.x, this.y)
  }
}
class Secret {
  #seen = 0
  constructor(readonly name: string) {}
}
const specOf = <D>(create: () => D) => ({
  schema: () => Schema.Any as Schema.Schema<D>,
  create,
  toDto: Effect.succeed,
})
interface Named {
  readonly name: string
}
const Plain = specOf((): Named => ({ name: '' }))
const Pointed = specOf(() => new Point(0, 0))
const Secretive = specOf(() => new Secret(''))
const Mapped = specOf(() => new Map<string, string>())

declare const model: Atom.Atom<Model>
declare const either: typeof Edit | Omit<typeof Edit, 'toModel'>

export function* typed() {
  const blank = yield* useDraft(Blank, undefined)
  // R11: `field` takes keys of the Draft only, and is typed by them
  expectTypeOf(blank.field('age')).toEqualTypeOf<Atom.Writable<string>>()
  // @ts-expect-error not a field of the Draft
  blank.field('email')
  // ... and a primitive or class-instance Draft has none: write `value`
  const note = yield* useDraft(Note, undefined)
  // @ts-expect-error a string Draft has no fields
  note.field(0)
  const when = yield* useDraft(When, undefined)
  // @ts-expect-error a Date's methods are not fields
  when.field('getTime')
  const point = yield* useDraft(Pointed, undefined)
  // @ts-expect-error a class with methods is an instance, so its data keys are not fields either
  point.field('x')
  const secret = yield* useDraft(Secretive, undefined)
  // @ts-expect-error ... nor those of a class with private members
  secret.field('name')
  const map = yield* useDraft(Mapped, undefined)
  // @ts-expect-error ... nor a Map's
  map.field('size')
  // A record typed by an interface is plain
  const plain = yield* useDraft(Plain, undefined)
  expectTypeOf(plain.field('name')).toEqualTypeOf<Atom.Writable<string>>()
  // R2, R5: no `preview` / `changes` without `toModel` / `diff`
  expectTypeOf(blank).not.toHaveProperty('preview')
  expectTypeOf(blank).not.toHaveProperty('changes')
  // ... and for a union of specs, only what every member has
  const mixed = yield* useDraft(either, model)
  expectTypeOf(mixed).not.toHaveProperty('preview')
  expectTypeOf(mixed.changes).toEqualTypeOf<Atom.Atom<Partial<Body>>>()

  // R3: the source is a value or an atom of it
  const edit = yield* useDraft(Edit, model)
  void (yield* useDraft(Edit, { name: 'Ada', age: 36 }))
  expectTypeOf(edit.preview).toEqualTypeOf<Atom.Atom<Model>>()
  expectTypeOf(edit.changes).toEqualTypeOf<Atom.Atom<Partial<Body>>>()
  // @ts-expect-error the source must be the spec's `Src`
  void (yield* useDraft(Edit, 'Ada'))

  // R9: toDto's E and R flow into a Form Action handler and its Result
  expectTypeOf(edit.toDto()).toEqualTypeOf<Effect.Effect<Body, ParseResult.ParseError | Taken, Ids | Store>>()
  const [result, action] = yield* useAction(function* () {
    return yield* edit.toDto()
  })
  expectTypeOf(result).toEqualTypeOf<Atom.Atom<Result.Result<Body, ParseResult.ParseError | Taken>>>()
  expectTypeOf(action).toEqualTypeOf<BoundAction<Ids | Store>>()
}
