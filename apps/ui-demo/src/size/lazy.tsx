/** @jsxImportSource @sleekstack/ui */
import { Boundary, lazy, mount, Pending } from '@sleekstack/ui'
import { Layer } from 'effect'

const Heavy = lazy(() => import('./heavy'))

/** Size budget entry (ADR 0022): a `mount` app whose `Heavy` component is a separate chunk. */
export const mountLazy = (container: Element) =>
  mount(
    <Boundary tag="LazyLoadError" fallback={() => <p>Failed</p>}>
      <Pending fallback={<p>Loading</p>}>
        <Heavy />
      </Pending>
    </Boundary>,
    { layer: Layer.empty, container },
  )
