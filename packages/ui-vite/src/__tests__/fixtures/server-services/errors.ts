import { Data } from 'effect'

export class Missing extends Data.TaggedError('Missing') {}
