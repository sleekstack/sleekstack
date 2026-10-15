/** @jsxImportSource @sleekstack/ui */
import { Data } from 'effect'
import { Boundary, type Ref, type Reset, useRef } from '@sleekstack/ui'

class RequestDropped extends Data.TaggedError('RequestDropped')<{}> {}

/** The page's first read fails, as a dropped request would; a later one succeeds. */
const Feed = function* ({ attempts }: { attempts: Ref<number> }) {
  const attempt = (attempts.current = (attempts.current ?? 0) + 1)
  if (attempt === 1) return yield* new RequestDropped()
  return <p className="feed">Loaded on attempt {attempt}</p>
}

/**
 * `reset` re-runs only the boundary's children, so the feed reads again. The lazy page's Retry is the same reset for a
 * failed import, which the app cannot cause; here every visit's first read fails.
 */
export const BoundaryDemo = function* () {
  const attempts = yield* useRef(0)
  return (
    <section className="demo boundary">
      <h2>Boundary reset</h2>
      <Boundary
        tag="RequestDropped"
        fallback={(_: RequestDropped, reset: Reset) => (
          <p className="error">
            The request dropped.{' '}
            <button type="button" className="retry" onClick={reset}>
              Retry
            </button>
          </p>
        )}
      >
        <Feed attempts={attempts} />
      </Boundary>
    </section>
  )
}
