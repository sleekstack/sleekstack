import { Effect, Ref } from 'effect'
import { TallyLimit } from '../../../src/pages/tally'
import { TallyCount } from '../../tally.layer'

const LIMIT = 3

/** The count. */
export const GET = (): Effect.Effect<number, never, TallyCount> => Effect.flatMap(TallyCount, Ref.get)

/** Adds `by` and answers the count; adding past `LIMIT` fails with the declared `TallyLimit`. */
export const POST = (input: {
  readonly body: { readonly by: number }
}): Effect.Effect<number, TallyLimit, TallyCount> =>
  Effect.flatMap(TallyCount, (count) =>
    Effect.flatMap(Ref.get(count), (n) =>
      n + input.body.by > LIMIT
        ? Effect.fail(new TallyLimit({ limit: LIMIT }))
        : Ref.updateAndGet(count, (m) => m + input.body.by),
    ),
  )
