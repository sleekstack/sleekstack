import { Data, Effect } from 'effect'
import { jsx } from './jsx-runtime'
import type { Node } from './node'

/** A `lazy` import rejected, or its module had no default export component. Catch it with `<Boundary tag="LazyLoadError">`. */
export class LazyLoadError extends Data.TaggedError('LazyLoadError')<{ readonly cause: unknown }> {}

/**
 * A component that imports its implementation on first render. Render it under `Pending` to show a fallback
 * meanwhile. The module loads once; a failed import is not cached, so the next render retries it.
 */
export const lazy = <P>(
  load: () => Promise<{ readonly default: (props: P) => unknown }>,
): ((props: P) => Effect.Effect<Node, LazyLoadError, never>) => {
  let loaded: ((props: P) => unknown) | undefined
  let loading: Promise<(props: P) => unknown> | undefined
  const get = () =>
    (loading ??= load()
      .then((m) => {
        if (typeof m?.default !== 'function') throw new TypeError('lazy: module has no default export component')
        return (loaded = m.default)
      })
      .catch((cause) => {
        loading = undefined
        throw cause
      }))
  const component = Effect.suspend(() =>
    loaded ? Effect.succeed(loaded) : Effect.tryPromise({ try: get, catch: (cause) => new LazyLoadError({ cause }) }),
  )
  return (props) => Effect.flatMap(component, (C) => jsx(C as never, props as never))
}
