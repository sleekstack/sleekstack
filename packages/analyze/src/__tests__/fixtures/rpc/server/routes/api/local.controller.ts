import { Data, Effect } from 'effect'

export class Over extends Data.TaggedError('Over')<{ readonly by: number }> {}
export const GET = (): Effect.Effect<void, Over> => Effect.void
