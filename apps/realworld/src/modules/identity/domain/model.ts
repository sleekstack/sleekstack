import { Schema } from 'effect'

/** The signed-in user as RealWorld returns it, token included. */
export const User = Schema.Struct({
  email: Schema.String,
  token: Schema.String,
  username: Schema.String,
  bio: Schema.NullOr(Schema.String),
  image: Schema.NullOr(Schema.String),
})
export type User = typeof User.Type

/** Another user as the viewer sees them; `following` is false for an anonymous viewer. */
export const Profile = Schema.Struct({
  username: Schema.String,
  bio: Schema.NullOr(Schema.String),
  image: Schema.NullOr(Schema.String),
  following: Schema.Boolean,
})
export type Profile = typeof Profile.Type

// Blank fields pass the Schemas: the service reports them as a `ValidationError` keyed by field.
export const NewUser = Schema.Struct({ username: Schema.String, email: Schema.String, password: Schema.String })
export type NewUser = typeof NewUser.Type

export const LoginUser = Schema.Struct({ email: Schema.String, password: Schema.String })
export type LoginUser = typeof LoginUser.Type

/** A partial update: an absent field, or an empty `password`, stays as it is. */
export const UpdateUser = Schema.Struct({
  email: Schema.optional(Schema.String),
  username: Schema.optional(Schema.String),
  password: Schema.optional(Schema.String),
  bio: Schema.optional(Schema.NullOr(Schema.String)),
  image: Schema.optional(Schema.NullOr(Schema.String)),
})
export type UpdateUser = typeof UpdateUser.Type
