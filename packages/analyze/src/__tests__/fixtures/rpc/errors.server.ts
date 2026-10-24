import { Data } from 'effect'

export class Boom extends Data.TaggedError('Boom')<{ readonly at: string }> {}
