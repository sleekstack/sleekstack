/** @jsxImportSource @sleekstack/ui */
import { lazy, mount, Pending } from '@sleekstack/ui'
import { Layer } from 'effect'

const Heavy = lazy(() => import('./heavy'))

/** Size budget entry (ADR 0022): a `mount` app whose `Heavy` component is a separate chunk.
 * Excluded from tsconfig: `sleekstack check` cannot yet read a `lazy` component ("dynamic component"). */
export const mountLazy = (container: Element) =>
  mount(
    <Pending fallback={<p>Loading</p>}>
      <Heavy />
    </Pending>,
    { layer: Layer.empty, container },
  )
