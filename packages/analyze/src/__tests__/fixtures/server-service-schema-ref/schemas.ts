import { Schema } from 'effect'

export const Name = Schema.NonEmptyString
export const User = Schema.Struct({ name: Name })
