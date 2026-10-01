/**
 * packages/kit/src/next/runtime.ts
 *
 * Kit-typed `configureRuntime`: validates and unwraps the provide set, builds a core app scope as the
 * runtime's layer (the adapter only ever sees a plain layer), adapts the finalizer sink to a plain
 * FinalizerError, and caches the lowered config per kit config reference so the adapter's
 * same-reference no-op still holds. Also owns the per-call request-scope layer the operations use.
 */

import type { AppScope, Entry, Module as CoreModule } from '@sleekstack/core'
import { makeAppScope } from '@sleekstack/core'
import {
  configureRuntime as nextConfigure,
  reportFinalizerFailure,
  type RuntimeConfig as NextConfig,
} from '@sleekstack/next'
import { Cause, Context, Effect, Exit, Layer } from 'effect'
import { normalize, toFinalizerError, type FinalizerError } from '../errors'
import type { Layer as KitLayer } from '../layer'
import { unwrap, validateProvide, type Module } from '../module'

/** Config for {@link configureRuntime}: the app's Layers/modules and an optional cleanup-failure sink. */
export interface RuntimeConfig {
  /** Identity across module copies (e.g. the RSC and Server Action bundles): the same `id` as the current config is a no-op. */
  readonly id?: string
  readonly provide: ReadonlyArray<KitLayer<any> | Module>
  readonly onFinalizerError?: (e: FinalizerError) => void
}

/** The app scope, provided by the runtime layer built in {@link configureRuntime}. */
const AppScopeTag = Context.GenericTag<AppScope>('@sleekstack/kit/AppScope')

/** Close a scope as an Effect that fails with the aggregated cause, so the owner's close reports it. */
const closeOrFail = (close: Effect.Effect<Exit.Exit<void, unknown>>): Effect.Effect<void> =>
  Effect.flatMap(close, (exit) => (Exit.isFailure(exit) ? Effect.failCause(exit.cause as Cause.Cause<never>) : Effect.void))

/** @internal The runtime Layer: a core app scope over `provide`. */
const appLayer = (provide: readonly (CoreModule | Entry)[]): NextConfig['layer'] =>
  Layer.scoped(
    AppScopeTag,
    Effect.acquireRelease(makeAppScope(provide, { onFinalizerError: reportFinalizerFailure }), (app) => closeOrFail(app.close)),
  ) as unknown as NextConfig['layer']

/** @internal The per-call request scope as a Layer: child-boundary `provide` shadows the runtime graph for this call only. */
export const requestLayer = (provide: readonly (CoreModule | Entry)[]): Layer.Layer<any, any, any> =>
  Layer.scopedContext(
    Effect.gen(function* () {
      const app = yield* AppScopeTag
      const child = yield* app.child('request', provide)
      yield* Effect.addFinalizer(() => closeOrFail(child.close))
      return child.context
    }),
  )

const lowered = new WeakMap<RuntimeConfig, NextConfig>()

/**
 * Configures the app runtime that `action`/`query` run in. Call it once at module load (for example
 * in `instrumentation.ts` or a shared server file); the same config reference (or `id`) again is a no-op.
 *
 * @param config - `provide` (Layers/modules), optional `id` and `onFinalizerError`.
 * @param options - `replace: true` replaces the runtime even for the same `id` (a dev hot reload of the configuring module).
 * @throws {@link SleekStackError} with code `DuplicateTag` when two distinct Tags share a key, or `InvalidModule` when `provide` holds a non-layer value.
 *
 * @example
 * ```ts
 * import { layer, module, tag } from '@sleekstack/kit'
 * import { configureRuntime } from '@sleekstack/kit/next'
 *
 * interface Clock { now(): number }
 * const Clock = tag<Clock>('Clock')
 * configureRuntime({ provide: [module({ name: 'app', provide: [layer(Clock, { now: () => Date.now() })] })] })
 * ```
 */
export function configureRuntime(config: RuntimeConfig, options: { readonly replace?: boolean } = {}): void {
  let next = lowered.get(config)
  if (!next) {
    try {
      validateProvide(config.provide)
      const sink = config.onFinalizerError
      next = {
        ...(config.id !== undefined && { id: config.id }),
        layer: appLayer(unwrap(config.provide)),
        // Defects and failed builds keep logging; only finalizer failures reach the kit sink, as a plain FinalizerError.
        onError: (cause, info) => {
          if (info.phase === 'finalizer' && sink) sink(toFinalizerError(cause))
          else console.error(Cause.pretty(cause))
        },
      }
    } catch (e) {
      throw normalize(e)
    }
    lowered.set(config, next)
  }
  nextConfigure(next, options)
}
