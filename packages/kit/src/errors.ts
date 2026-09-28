/**
 * packages/kit/src/errors.ts
 *
 * The one public error type. Core's tagged errors, kit sentinels and plain throws
 * are converted by the internal `normalize()` at every public boundary.
 */

import { Cause, Runtime } from 'effect'

/** Every `code` a {@link SleekStackError} can carry. */
export type SleekStackErrorCode =
  | 'MissingDependency'
  | 'CleanupFailed'
  | 'DependencyCycle'
  | 'AmbiguousProvider'
  | 'ModuleCycle'
  | 'DuplicateModule'
  | 'InvalidModule'
  | 'CaptiveDependency'
  | 'PrivateDependency'
  | 'DuplicateTag'
  | 'InvalidTag'
  | 'LayerFailed'
  | 'HandlerFailed'
  | 'AtomCycle'
  | 'Unknown'

/**
 * The one error type kit throws. `code` says what went wrong; `details` carries structured context
 * (for example the Tag key).
 *
 * @example
 * ```ts
 * import { SleekStackError, module, snapshot } from '@sleekstack/kit'
 *
 * try {
 *   snapshot(module({ name: 'app' }))
 * } catch (e) {
 *   if (e instanceof SleekStackError && e.code === 'MissingDependency') console.error(e.details)
 * }
 * ```
 */
export class SleekStackError extends Error {
  readonly code: SleekStackErrorCode
  readonly details: Readonly<Record<string, unknown>>
  constructor(code: SleekStackErrorCode, message: string, details: Readonly<Record<string, unknown>> = {}, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'SleekStackError'
    this.code = code
    this.details = details
  }
}

/** A finalizer (cleanup) failure, as handed to `onFinalizerError`. */
export interface FinalizerError {
  readonly message: string
  readonly tag?: string
}

const GRAPH_CODES = new Set<string>([
  'MissingDependency', 'DependencyCycle', 'AmbiguousProvider', 'ModuleCycle', 'DuplicateModule', 'InvalidModule', 'CaptiveDependency', 'PrivateDependency', 'AtomCycle',
])

/** @internal A layer factory threw or rejected. */
export class LayerFailure extends Error {
  constructor(readonly tag: string, cause: unknown) {
    super(`Layer for "${tag}" failed: ${cause instanceof Error ? cause.message : String(cause)}`, { cause })
  }
}

/** @internal A `withCleanup` cleanup threw or rejected; carries the Layer's Tag key. */
export class CleanupFailure extends Error {
  constructor(readonly tag: string, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause })
  }
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** @internal Converts anything thrown (or an Effect Cause) into a SleekStackError. */
export function normalize(e: unknown, fallback: SleekStackErrorCode = 'Unknown'): SleekStackError {
  if (e instanceof SleekStackError) return e
  if (Cause.isCause(e)) return normalize(Cause.squash(e), fallback)
  if (Runtime.isFiberFailure(e)) return normalize(e[Runtime.FiberFailureCauseId], fallback)
  if (e instanceof LayerFailure) {
    return new SleekStackError('LayerFailed', e.message, { tag: e.tag, cause: messageOf(e.cause) }, { cause: e.cause })
  }
  if (e instanceof CleanupFailure) {
    return new SleekStackError('CleanupFailed', e.message, { tag: e.tag }, { cause: e.cause })
  }
  const tag = (e as { _tag?: unknown } | null)?._tag
  if (e instanceof Error && typeof tag === 'string' && GRAPH_CODES.has(tag)) {
    const { _tag, message, ...details } = { ...e } as Record<string, unknown>
    return new SleekStackError(tag as SleekStackErrorCode, e.message, details, { cause: e })
  }
  return new SleekStackError(fallback, messageOf(e), {}, { cause: e })
}

/** @internal Anything a finalizer sink receives (a Cause or a thrown value) -> plain FinalizerError. */
export const toFinalizerError = (e: unknown): FinalizerError => {
  const k = normalize(e)
  const tag = k.details.tag
  return typeof tag === 'string' ? { message: k.message, tag } : { message: k.message }
}
