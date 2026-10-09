import { Layer } from 'effect'
import { Boundary, lazy, mount, Pending } from '@sleekstack/ui'
import { Repo } from './loaded'

// The analyzer follows `lazy` into the imported module's default export.
const Loaded = lazy(() => import('./loaded'))

export const ok = (c: Element) =>
  mount(
    <Boundary tag="LazyLoadError" fallback={() => <p>failed</p>}>
      <Pending fallback={<p>loading</p>}>
        <Loaded />
      </Pending>
    </Boundary>,
    { layer: Layer.succeed(Repo, 'r'), container: c },
  )
export const missing = (c: Element) =>
  mount(
    <Boundary tag="LazyLoadError" fallback={() => <p>failed</p>}>
      <Loaded /> {/* // @error MissingDependency: Repo, from the loaded module */}
    </Boundary>,
    { layer: Layer.empty, container: c },
  )
export const unhandled = (c: Element) => mount(<Loaded />, { layer: Layer.succeed(Repo, 'r'), container: c }) // @error UnhandledError
