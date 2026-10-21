import { Effect, Layer, Ref } from 'effect'
import { Tally, TallyLimit } from '../src/pages/tally'

const LIMIT = 3

/** The tally, held by the server process; adding past `LIMIT` fails with the declared `TallyLimit`. */
export const TallyLive = Layer.effect(
  Tally,
  Effect.map(Ref.make(0), (count) => ({
    add: ({ by }: { readonly by: number }) =>
      Effect.flatMap(Ref.get(count), (n) =>
        n + by > LIMIT ? Effect.fail(new TallyLimit({ limit: LIMIT })) : Ref.updateAndGet(count, (m) => m + by),
      ),
    read: () => Ref.get(count),
  })),
)
