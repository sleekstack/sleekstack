import { Data, Schema } from 'effect'

export const Note = Schema.Struct({ text: Schema.String })
export class Missing extends Data.TaggedError('Missing')<{ readonly id: string }> {}
export class TallyLimit extends Data.TaggedError('TallyLimit')<{ readonly limit: number }> {}
