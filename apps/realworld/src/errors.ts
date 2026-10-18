import { Schema } from 'effect'

/** Field errors keyed by field name, as the RealWorld `{errors: {...}}` body carries them. */
const FieldErrors = Schema.Record({ key: Schema.String, value: Schema.Array(Schema.String) })

/** The input breaks a rule (blank field, taken email or username): REST 422. */
export class ValidationError extends Schema.TaggedError<ValidationError>()('ValidationError', {
  errors: FieldErrors,
}) {}

/** No viewer where one is required, or a bad or expired token: REST 401. */
export class Unauthorized extends Schema.TaggedError<Unauthorized>()('Unauthorized', {}) {}

/** The viewer may not do this (not the author, wrong login): REST 403. */
export class Forbidden extends Schema.TaggedError<Forbidden>()('Forbidden', { errors: FieldErrors }) {}

/** No such article, comment or profile: REST 404. */
export class NotFound extends Schema.TaggedError<NotFound>()('NotFound', { resource: Schema.String }) {}
