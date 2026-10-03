/**
 * packages/kit/src/errors.ts
 *
 * The one public error type. Core's tagged errors, kit sentinels and plain throws
 * are converted by the internal `normalize()` at every public boundary.
 */

import { Cause, Runtime } from 'effect'

/** The structured `details` each {@link SleekStackError} `code` carries (mirrors core's tagged error fields). */
export interface SleekStackErrorDetails {
  MissingDependency: { readonly tag?: string; readonly service: string; readonly missing: string; readonly module?: string }
  CleanupFailed: { readonly tag: string }
  DependencyCycle: { readonly path: readonly string[] }
  AmbiguousProvider: { readonly tag: string; readonly modules: readonly string[] }
  ModuleCycle: { readonly path: readonly string[] }
  DuplicateModule: { readonly name: string }
  InvalidModule: { readonly name?: string }
  CaptiveDependency: { readonly service: string; readonly lifetime: string; readonly dependency: string; readonly dependencyLifetime: string }
  PrivateDependency: { readonly tag: string; readonly module: string; readonly requiredBy: string }
  DuplicateTag: { readonly tag: string }
  InvalidTag: {}
  LayerFailed: { readonly tag: string; readonly cause: string }
  HandlerFailed: {}
  AtomCycle: { readonly path: readonly string[] }
  /** A `serializable` query's `decode` threw on server-prefetched data. */
  QueryDecodeFailed: { readonly key: string }
  /** A server render read an un-prefetched query, but no server query runner is registered (import `@sleekstack/kit/next` on the server). */
  NoServerRunner: {}
  Unknown: {}
}

/** Every `code` a {@link SleekStackError} can carry. */
export type SleekStackErrorCode = keyof SleekStackErrorDetails

/**
 * The one error type kit throws, discriminated by `code`: checking `e.code` narrows `e.details`.
 *
 * @example
 * ```ts
 * import { SleekStackError, module } from '@sleekstack/kit'
 *
 * try {
 *   module({ name: 'app', imports: [{} as never] })
 * } catch (e) {
 *   if (e instanceof SleekStackError && e.code === 'InvalidModule') console.error(e.details.name)
 * }
 * ```
 */
export type SleekStackError<C extends SleekStackErrorCode = SleekStackErrorCode> = C extends SleekStackErrorCode
  ? Error & { readonly name: 'SleekStackError'; readonly code: C; readonly details: SleekStackErrorDetails[C] }
  : never

type Options = { cause?: unknown }
/** Constructor arguments, correlated per code; codes without details accept only an empty object. */
type SleekStackErrorArgs<C extends SleekStackErrorCode> = C extends SleekStackErrorCode
  ? keyof SleekStackErrorDetails[C] extends never
    ? [code: C, message: string, details?: Record<PropertyKey, never>, options?: Options]
    : {} extends SleekStackErrorDetails[C]
      ? [code: C, message: string, details?: SleekStackErrorDetails[C], options?: Options]
      : [code: C, message: string, details: SleekStackErrorDetails[C], options?: Options]
  : never

/** Constructs a {@link SleekStackError}; also the `instanceof` check. */
export const SleekStackError = class SleekStackError extends Error {
  constructor(readonly code: SleekStackErrorCode, message: string, readonly details: object = {}, options?: Options) {
    super(message, options)
    this.name = 'SleekStackError'
  }
} as unknown as {
  new <C extends SleekStackErrorCode>(...args: SleekStackErrorArgs<C>): SleekStackError<C>
  readonly prototype: SleekStackError
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

const NO_SERVER_RUNNER = /^No server query runner/

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** @internal Converts anything thrown (or an Effect Cause) into a SleekStackError. */
export function normalize(e: unknown, fallback: 'Unknown' | 'HandlerFailed' | 'InvalidModule' = 'Unknown'): SleekStackError {
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
    return new SleekStackError(tag as SleekStackErrorCode, e.message, details as never, { cause: e })
  }
  if (e instanceof Error && NO_SERVER_RUNNER.test(e.message)) {
    return new SleekStackError('NoServerRunner', 'No server query runner: import @sleekstack/kit/next on the server, or prefetch the query.', {}, { cause: e })
  }
  return new SleekStackError(fallback, messageOf(e), {}, { cause: e })
}

/** @internal Anything a finalizer sink receives (a Cause or a thrown value) -> plain FinalizerError. */
export const toFinalizerError = (e: unknown): FinalizerError => {
  const k = normalize(e)
  const tag = 'tag' in k.details ? k.details.tag : undefined
  return typeof tag === 'string' ? { message: k.message, tag } : { message: k.message }
}
