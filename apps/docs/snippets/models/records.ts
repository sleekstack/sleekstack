import { defineRecord, defineTransformation, field, type RecordAdapter, ref, refs } from '@sleekstack/model'
import { Data, Effect, Layer, ParseResult, Schema } from 'effect'

// A per-field transformation: wire cents, the app value a bounded decimal string with its currency.
export const Money = defineTransformation('money', (options: { readonly currency: string }) => ({
  from: Schema.Number,
  to: Schema.String.pipe(Schema.pattern(/^\d{1,9}(\.\d{1,2})?$/)),
  hydrate: (cents: number, ast) =>
    Number.isSafeInteger(cents)
      ? Effect.succeed((cents / 100).toFixed(2))
      : Effect.fail(new ParseResult.Type(ast, cents, `${options.currency} cents must be a safe integer`)),
  serialize: (amount: string) => Effect.succeed(Math.round(Number(amount) * 100)),
  defaultValue: () => '0.00',
}))

// The wire contract of each record type is an app-written adapter Service.
export class NotFound extends Data.TaggedError('NotFound')<{ readonly id: string }> {}
type AuthorWire = { readonly id: string; readonly name: string }
type BookWire = {
  readonly id: string
  readonly title: string
  readonly price: number | undefined
  readonly author: string | null
  readonly editors: ReadonlyArray<string>
}
export class AuthorApi extends Effect.Tag('AuthorApi')<AuthorApi, RecordAdapter<AuthorWire, unknown, NotFound>>() {}
export class BookApi extends Effect.Tag('BookApi')<BookApi, RecordAdapter<BookWire, unknown, NotFound>>() {}

export const Author = defineRecord('author', {
  fields: { id: Schema.String, name: Schema.String },
  adapter: AuthorApi,
})

export const Book = defineRecord('book', {
  fields: {
    id: Schema.String,
    title: Schema.String.pipe(Schema.maxLength(200)),
    price: field(Money, { currency: 'EUR' }),
    author: ref(() => Author),
    editors: refs(() => Author),
  },
  adapter: BookApi,
})

// A REST server that wraps each record in `{ data }` and takes a PATCH of the change. A GraphQL server would be
// another Layer for the same Tag; the record does not change.
declare const http: {
  get(path: string): Effect.Effect<{ readonly data: BookWire }, NotFound>
  patch(path: string, body: unknown): Effect.Effect<{ readonly data: BookWire }, NotFound>
}
export const BookRest = Layer.succeed(BookApi, {
  find: (id) => Effect.map(http.get(`/books/${id}`), (res) => res.data),
  save: (id, change) => Effect.map(http.patch(`/books/${id}`, change), (res) => res.data),
})
