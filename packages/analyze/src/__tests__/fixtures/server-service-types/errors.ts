import { Data, Schema } from 'effect'

export class Missing extends Data.TaggedError('Missing') {}
export class Invalid extends Schema.TaggedError<Invalid>()('Invalid', {
  errors: Schema.Record({ key: Schema.String, value: Schema.Array(Schema.String) }),
}) {}
