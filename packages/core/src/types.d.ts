/**
 * packages/core/src/types.d.ts
 *
 * Public types for @sleekstack/core.
 * Re-exported from packages/core/src/index.ts.
 */

import type { Context, Layer } from 'effect'

/**
 * Opaque typed wrapper returned by module(). Never construct directly.
 *
 * The `Exports` type parameter represents the union of Context.Tag values
 * explicitly surfaced by this module. Defaults to `never` (no exports).
 */
export type Module<Exports extends Context.Tag<any, any> = never> = {
  readonly _name: string
  readonly _layers: readonly Layer.Layer<any, any, any>[]
  readonly _imports: readonly Module<any>[]
  readonly _exports: readonly Exports[]
}

/**
 * Create a Module value — the pure-data foundation of the SleekStack layer graph.
 *
 * @param config.name     - Unique identifier for this module (required, non-empty string)
 * @param config.layers   - Effect Layers that this module provides
 * @param config.imports  - Other Module values this module depends on
 * @param config.exports  - Tags to surface as this module's public API (best-effort type narrowing)
 *
 * Throws synchronously if a circular import graph is detected (CORE-02).
 * Throws synchronously if `name` is not a non-empty string.
 */
export declare function module<E extends readonly Context.Tag<any, any>[]>(config: {
  name: string
  layers: Layer.Layer<any, any, any>[]
  imports?: Module<any>[]
  exports?: E
}): Module<E[number]>
