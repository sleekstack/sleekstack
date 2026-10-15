import type { Atom, DraftSpec, Result } from '@sleekstack/core'
import { Context, Data, Effect, type ParseResult, Schema } from 'effect'
import { expectTypeOf } from 'vitest'
import { type BoundAction, type Store, useAction, useDraft } from '../index'

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

declare const model: Atom.Atom<Model>

export function* typed() {
  const blank = yield* useDraft(Blank, undefined)
  // R11: `field` takes keys of the Draft only, and is typed by them
  expectTypeOf(blank.field('age')).toEqualTypeOf<Atom.Writable<string>>()
  // @ts-expect-error not a field of the Draft
  blank.field('email')
  // R2, R5: no `preview` / `changes` without `toModel` / `diff`
  expectTypeOf(blank).not.toHaveProperty('preview')
  expectTypeOf(blank).not.toHaveProperty('changes')

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
