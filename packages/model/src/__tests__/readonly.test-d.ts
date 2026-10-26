import { Effect, Schema, type Types } from 'effect'
import { expectTypeOf } from 'vitest'
import {
  defineRecord,
  defineTransformation,
  field,
  readOnly,
  type RecordChange,
  RecordNotFound,
  RecordRejected,
  ref,
} from '../index'

const Count = defineTransformation('count', () => ({
  from: Schema.Number,
  to: Schema.NumberFromString,
  hydrate: (n: number) => Effect.succeed(String(n)),
  serialize: (input: string) => Effect.succeed(Number(input)),
  defaultValue: () => '0',
}))
const Author = defineRecord('author', { fields: { id: Schema.String, name: Schema.String } })
const fields = {
  id: readOnly(Schema.String),
  title: Schema.String,
  qty: field(Count),
  createdAt: readOnly(Schema.Date),
  author: readOnly(ref(() => Author)),
}
const Article = defineRecord('article', { fields })

expectTypeOf<Schema.Schema.Type<typeof Article.schema>>().toEqualTypeOf<{
  readonly id: string
  readonly title: string
  readonly qty: number
  readonly createdAt: Date
  readonly author: string | null
}>()
expectTypeOf<Types.Simplify<RecordChange<typeof fields>>>().toEqualTypeOf<{
  readonly title: string
  readonly qty: number | undefined
}>()
expectTypeOf<Schema.Schema.Type<typeof Article.change>>().toEqualTypeOf<RecordChange<typeof fields>>()
expectTypeOf<Schema.Schema.Encoded<typeof Article.change>>().toEqualTypeOf<RecordChange<typeof fields>>()
Effect.map(Article.useDraft('1'), (draft) => {
  expectTypeOf<Effect.Effect.Success<ReturnType<typeof draft.toDto>>>().toEqualTypeOf<RecordChange<typeof fields>>()
  // @ts-expect-error a read-only field has no Draft field
  draft.field('createdAt')
})

// @ts-expect-error readOnly takes a Schema
readOnly('createdAt')

expectTypeOf<ConstructorParameters<typeof RecordNotFound>[0]>().toEqualTypeOf<{
  readonly type: string
  readonly id: string
}>()
expectTypeOf<ConstructorParameters<typeof RecordRejected>[0]>().toEqualTypeOf<{
  readonly type: string
  readonly id: string
  readonly message: string
}>()
