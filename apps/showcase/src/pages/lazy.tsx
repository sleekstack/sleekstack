/** @jsxImportSource @sleekstack/ui */
import { Boundary, lazy, type LazyLoadError, Pending, type Reset } from '@sleekstack/ui'

/** Its own chunk, imported on first render: `renderToString` waits for it and `hydrateMount` adopts its nodes. */
const Chart = lazy(() => import('./chart'))

/** A failed import (a dropped request) is a `LazyLoadError`; `reset` re-runs the boundary's children, which import again. */
export const LazyDemo = () => (
  <section className="demo lazy">
    <h2>lazy</h2>
    <Boundary
      tag="LazyLoadError"
      fallback={(_: LazyLoadError, reset: Reset) => (
        <p className="error">
          The chart failed to load.{' '}
          <button type="button" className="retry" onClick={reset}>
            Retry
          </button>
        </p>
      )}
    >
      <Pending fallback={<p className="muted">Loading the chart</p>}>
        <Chart values={[3, 7, 4, 9, 5, 8]} />
      </Pending>
    </Boundary>
  </section>
)
