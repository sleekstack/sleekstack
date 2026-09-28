/**
 * packages/kit/src/next/runtime.ts
 *
 * Kit-typed `configureRuntime`: validates and unwraps the provide set, adapts the
 * finalizer sink to a plain FinalizerError, and caches the lowered config per kit
 * config reference so next's same-reference no-op still holds.
 */

import { configureRuntime as nextConfigure, type RuntimeConfig as NextConfig } from '@sleekstack/next'
import { Cause } from 'effect'
import { normalize, toFinalizerError, type FinalizerError } from '../errors'
import type { Layer } from '../layer'
import { unwrap, validateProvide, type Module } from '../module'

/** Config for {@link configureRuntime}: the app's Layers/modules and an optional cleanup-failure sink. */
export interface RuntimeConfig {
  readonly provide: ReadonlyArray<Layer<any> | Module>
  readonly onFinalizerError?: (e: FinalizerError) => void
}


const lowered = new WeakMap<RuntimeConfig, NextConfig>()

/**
 * Configures the app runtime that `action`/`query` run in. Call it once at module load (for example
 * in `instrumentation.ts` or a shared server file); the same config reference again is a no-op.
 *
 * @param config - `provide` (Layers/modules) and optional `onFinalizerError`.
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
export function configureRuntime(config: RuntimeConfig): void {
  let next = lowered.get(config)
  if (!next) {
    try {
      validateProvide(config.provide)
      const sink = config.onFinalizerError
      next = {
        provide: unwrap(config.provide),
        ...(sink && { onFinalizerError: (cause: Cause.Cause<unknown>) => sink(toFinalizerError(cause)) }),
      }
    } catch (e) {
      throw normalize(e)
    }
    lowered.set(config, next)
  }
  nextConfigure(next)
}
