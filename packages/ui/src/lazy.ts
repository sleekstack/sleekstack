import { Data, Effect } from 'effect'
import type { YieldWrap } from 'effect/Utils'
import { jsx } from './jsx-runtime'
import type { Node } from './node'
import type { ComponentResult } from './reactive'

/** A `lazy` import rejected, or its module had no default export component. Catch it with `<Boundary tag="LazyLoadError">`. */
export class LazyLoadError extends Data.TaggedError('LazyLoadError')<{ readonly cause: unknown }> {}

/** `E` / `R` of a component's result: an Effect's, or a generator's yields plus its returned Effect. */
type ResultError<T> =
  T extends Effect.Effect<any, infer E, any>
    ? E
    : T extends Generator<infer Y, infer Ret, any>
      ? (Y extends YieldWrap<Effect.Effect<any, infer E, any>> ? E : never) | ResultError<Ret>
      : never
type ResultContext<T> =
  T extends Effect.Effect<any, any, infer R>
    ? R
    : T extends Generator<infer Y, infer Ret, any>
      ? (Y extends YieldWrap<Effect.Effect<any, any, infer R>> ? R : never) | ResultContext<Ret>
      : never

/**
 * A component that imports its implementation on first render. Render it under `Pending` to show a fallback
 * meanwhile. The module loads once; a failed import is not cached, so the next render retries it.
 */
export const lazy = <C extends (props: any) => ComponentResult>(
  load: () => Promise<{ readonly default: C }>,
): ((
  props: Parameters<C> extends [infer P, ...unknown[]] ? P : {},
) => Effect.Effect<Node, ResultError<ReturnType<C>> | LazyLoadError, ResultContext<ReturnType<C>>>) => {
  let loaded: C | undefined
  let loading: Promise<C> | undefined
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
  return (props) => Effect.flatMap(component, (Loaded) => jsx(Loaded, props as never))
}
