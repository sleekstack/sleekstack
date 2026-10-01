/**
 * packages/next/src/runtime.ts
 *
 * The Next preset over `@sleekstack/runtime`: Next's control-flow classifier and a `runEffect` that
 * falls back to it, so a runtime configured without a classifier (including an older copy's) still
 * rethrows `redirect()`/`notFound()` untouched.
 */

import type { Effect } from 'effect'
import { runEffect as baseRunEffect, type RunEffectOptions } from '@sleekstack/runtime'

/** Next.js control-flow throws (`redirect()`, `notFound()`, `forbidden()`, ...): rethrown untouched, never reported. */
/** @internal */
export const isNextControlFlow = (value: unknown): boolean => {
  const digest = (value as { digest?: unknown } | null)?.digest
  return (
    typeof digest === 'string' &&
    (digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_HTTP_ERROR_FALLBACK') ||
      digest === 'NEXT_NOT_FOUND' ||
      digest === 'DYNAMIC_SERVER_USAGE' ||
      digest === 'BAILOUT_TO_CLIENT_SIDE_RENDERING')
  )
}

/**
 * Runs `effect` on the configured runtime (see `@sleekstack/runtime`'s `runEffect`), classifying Next
 * control flow unless the runtime config or the call supplies its own classifier.
 *
 * @param effect - The Effect to run.
 * @param options - Optional per-call `request` and `overrides` Layers.
 * @returns A promise of the Effect's value.
 * @throws `RuntimeNotConfigured` (rejection) when `runEffect` is called before `configureRuntime`.
 * @throws `FiberFailure` (rejection, as `Effect.runPromise`) on a typed failure, defect or interruption;
 *   a Next `redirect()`/`notFound()` throw is rethrown as-is.
 *
 * @example
 * ```ts
 * import { Effect, Layer } from 'effect'
 * import { configureRuntime, runEffect } from '@sleekstack/next'
 *
 * configureRuntime({ layer: Layer.empty })
 * await runEffect(Effect.succeed(1))
 * ```
 */
export function runEffect<A, E, R>(effect: Effect.Effect<A, E, R>, options: RunEffectOptions = {}): Promise<A> {
  return baseRunEffect(effect, { isControlFlow: isNextControlFlow, ...options })
}
