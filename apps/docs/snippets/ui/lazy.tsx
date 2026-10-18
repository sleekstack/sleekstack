/** @jsxImportSource @sleekstack/ui */
import { Boundary, lazy, type LazyLoadError, Pending, type Reset } from '@sleekstack/ui'

// Its own chunk, imported on first render. Its props are the default export's props.
const Chart = lazy(() => import('./chart'))

export const Report = () => (
  <Boundary
    tag="LazyLoadError"
    fallback={(_: LazyLoadError, reset: Reset) => (
      <p>
        The chart failed to load.{' '}
        <button type="button" onClick={reset}>
          Retry
        </button>
      </p>
    )}
  >
    <Pending fallback={<p>Loading the chart</p>}>
      <Chart values={[3, 7, 4, 9]} />
    </Pending>
  </Boundary>
)
