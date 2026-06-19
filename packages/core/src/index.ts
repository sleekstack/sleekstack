/**
 * packages/core/src/index.ts
 *
 * @sleekstack/core public barrel.
 *
 * Exports:
 *   module() — the only runtime export; creates a typed Module value
 *   Module   — re-exported type
 *
 * Does NOT export: createService, layer, EffectLib, ServiceTag, LayerLike,
 * or any Effect primitive — per ADR 0001 (middle-path Effect coupling).
 * Users import Tag/Layer/Effect directly from 'effect'.
 */

import type { Context, Layer } from 'effect'
import type { Module } from './types'
import { detectCycles } from './cycle'

/**
 * Create a Module value — the pure-data foundation of the SleekStack layer graph.
 *
 * @param config.name    - Unique identifier for this module (non-empty string, required)
 * @param config.layers  - Effect Layers that this module provides
 * @param config.imports - Other Module values this module depends on
 * @param config.exports - Tags to surface as the module's public API (best-effort type narrowing)
 *
 * @throws {Error} if `name` is not a non-empty plain string (input validation — T-02-01)
 * @throws {Error} if a circular import graph is detected (synchronous, with full trace — CORE-02)
 *
 * @example
 * ```ts
 * import { Context, Layer } from 'effect'
 * import { module } from '@sleekstack/core'
 *
 * class MyService extends Context.Tag('MyService')<MyService, { greet: () => string }>() {}
 * const MyLayer = Layer.succeed(MyService, { greet: () => 'hello' })
 *
 * export const MyModule = module({
 *   name: 'MyModule',
 *   layers: [MyLayer],
 *   exports: [MyService],
 * })
 * ```
 */
export function module<E extends readonly Context.Tag<any, any>[]>(config: {
  name: string
  layers: Layer.Layer<any, any, any>[]
  imports?: Module<any>[]
  exports?: E
}): Module<E[number]> {
  // --- Input validation (T-02-01: prevent prototype-pollution via crafted name values)
  // name must be a plain non-empty string. We use typeof guard (not instanceof) to
  // reject objects, numbers, null, undefined, Symbols, etc. We deliberately do NOT
  // use the name value as an object property key — only as a string identifier.
  if (typeof config.name !== 'string' || config.name.trim().length === 0) {
    throw new Error(
      `module(): 'name' must be a non-empty string, got: ${JSON.stringify(config.name)}`
    )
  }

  const mod: Module<E[number]> = {
    _name: config.name,
    _layers: config.layers,
    _imports: config.imports ?? [],
    _exports: (config.exports ?? []) as readonly E[number][],
  }

  // --- Circular-import detection (CORE-02, T-02-02)
  // detectCycles uses {name, imports} shape; we map from Module's {_name, _imports}.
  // This keeps cycle.ts independent of the full Module type (no internal field coupling).
  function toDetectShape(m: Module<any>): { name: string; imports?: { name: string; imports?: any[] }[] } {
    return {
      name: m._name,
      imports: m._imports.map(toDetectShape),
    }
  }
  detectCycles(toDetectShape(mod))

  return mod
}

export type { Module } from './types'
