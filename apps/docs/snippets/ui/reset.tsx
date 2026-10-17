/** @jsxImportSource @sleekstack/ui */
import { Context, Data, Effect } from 'effect'
import { Boundary, type Reset } from '@sleekstack/ui'

class FeedDown extends Data.TaggedError('FeedDown')<{}> {}
class Feed extends Context.Tag('Feed')<Feed, { readonly latest: Effect.Effect<string, FeedDown> }>() {}

const Latest = function* () {
  const feed = yield* Feed
  const text = yield* feed.latest
  return <p>{text}</p>
}

// `reset` re-runs only the boundary's children, so Latest reads the feed again.
export const News = () => (
  <Boundary
    tag="FeedDown"
    fallback={(_: FeedDown, reset: Reset) => (
      <p>
        The feed is down. <button onClick={reset}>Retry</button>
      </p>
    )}
  >
    <Latest />
  </Boundary>
)
