import { Schema } from 'effect'

export const Id = Schema.NumberFromString
export const Count = Schema.Number
export const User = Schema.Struct({ name: Schema.NonEmptyString })
export const Params = Schema.Struct({ id: Schema.NumberFromString })
export const Page = Schema.Struct({ page: Schema.NumberFromString, tags: Schema.optional(Schema.Array(Schema.String)) })
export const Nested = Schema.Struct({ id: Schema.Number })
export const Input = Schema.Struct({ body: User })
