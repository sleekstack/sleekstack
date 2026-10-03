import { Cause, Effect, Exit, Layer, Option } from 'effect'
import type { ComponentType } from 'react'
import type { Node } from './node'

export type Component<P, E, R> = (props: P) => Effect.Effect<Node, E, R>

/** Provides `layer` to `children`; the layer's requirements and errors join the result's. */
export const Provide = <A, LE, RL, E, R2>(
  layer: Layer.Layer<A, LE, RL>,
  children: Effect.Effect<Node, E, R2>,
): Effect.Effect<Node, E | LE, RL | Exclude<R2, A>> => Effect.provide(children, layer)

/** Renders `fallback` when `children` fails with `tag`; removes only that tag from `E`. */
export const Catch = <E extends { readonly _tag: string }, R, K extends E['_tag']>(
  tag: K,
  fallback: (e: Extract<E, { _tag: K }>) => Node,
  children: Effect.Effect<Node, E, R>,
): Effect.Effect<Node, Exclude<E, { _tag: K }>, R> =>
  // Effect.catchTag cannot narrow a generic E; its runtime is exactly this tag match.
  Effect.catchTag(children as Effect.Effect<Node, { _tag: string }, R>, tag as string, (e) =>
    Effect.succeed(fallback(e as Extract<E, { _tag: K }>)),
  ) as unknown as Effect.Effect<Node, Exclude<E, { _tag: K }>, R>

/** Wraps a plain React component as a guest leaf. It receives no Effect context. */
export const fromReact =
  <P extends object>(Cmp: ComponentType<P>): Component<P, never, never> =>
  (props) =>
    Effect.succeed({ _tag: 'Guest', component: Cmp, props })

/**
 * Runs `app` with `layer` to a `Node`. Rejects with the original failure (from `E` or `LE`)
 * or the defect, never a `FiberFailure`; `onError` also receives the cause. Shared by renderers.
 */
export const runToNode = async <E, A, LE>(
  app: Effect.Effect<Node, E, A>,
  layer: Layer.Layer<A, LE, never>,
  onError?: (cause: Cause.Cause<unknown>) => void,
): Promise<Node> => {
  const exit = await Effect.runPromiseExit(Effect.provide(app, layer))
  if (Exit.isSuccess(exit)) return exit.value
  if (onError) safeReport(exit.cause, onError)
  const failure = Cause.failureOption(exit.cause)
  if (Option.isSome(failure)) throw failure.value
  const defect = Cause.dieOption(exit.cause)
  if (Option.isSome(defect)) throw defect.value
  throw Cause.squash(exit.cause)
}

/** Calls `onError`; a throwing sink is logged and never replaces the original outcome. */
const safeReport = (cause: Cause.Cause<unknown>, onError: (cause: Cause.Cause<unknown>) => void): void => {
  try {
    onError(cause)
  } catch (sinkError) {
    console.error(sinkError)
  }
}

/** Reports a renderer failure to `onError`, or `console.error` when absent. Never throws. */
export const reportRenderError = (error: unknown, onError?: (cause: Cause.Cause<unknown>) => void): void => {
  const cause = Cause.die(error)
  if (onError) safeReport(cause, onError)
  else console.error(cause)
}
