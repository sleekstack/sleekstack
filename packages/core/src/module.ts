/**
 * packages/core/src/module.ts
 *
 * module() and declareLayer(). module() validates only its own structure;
 * everything needing the whole graph (cycles, duplicate names, deps) lives in the scope runtime and the analyzer.
 */

import { Context, Layer } from 'effect'
import type { Lifetime } from './lifetime'
import { InvalidModule } from './errors'

type AnyTag = Context.Tag<any, any>

/** A raw Layer with its {@link Lifetime}. What it provides and requires is read from its type by `sleekstack check`. */
export interface DeclaredLayer {
  readonly _tag: 'DeclaredLayer'
  readonly layer: Layer.Layer<any, any, any>
  readonly lifetime?: Lifetime
  /** @internal false: the Layer's failures pass through unwrapped (for adapters, like kit, that own their error types). */
  readonly attribute?: false
}

/** Bare raw Layers must be self-contained (requirement type `never`). */
export type BareLayer = Layer.Layer<any, any, never>

/** Anything a module's `entries` may list: a declared Layer, or a self-contained bare Layer. */
export type Entry = DeclaredLayer | BareLayer

/** A module's imports: a list, or a thunk returning one (for modules defined later or in a cycle-free forward reference). */
export type Imports = readonly Module[] | (() => readonly Module[])

/** A named group of entries created by {@link module}, with imports and optional `exports` (privacy). */
export interface Module {
  readonly _tag: 'Module'
  readonly name: string
  readonly entries: readonly Entry[]
  readonly imports: Imports
  /** Omitted: every provided Tag is public. Given: every other Tag this module provides is private to it. */
  readonly exports?: readonly AnyTag[]
  readonly lifetime?: Lifetime
}

/**
 * Wraps a raw Effect Layer with its {@link Lifetime}. The Tags it provides and requires are read from the
 * Layer's type by `sleekstack check`; the runtime builds Layers in position order and keeps no graph.
 *
 * @param layer - The Effect Layer to declare.
 * @param options - Optional `lifetime` (default: the module's, else `'app'`).
 * @returns A declared Layer to list in a module's `entries`.
 * @throws {@link InvalidModule} `InvalidModule` when `layer` is not a Layer.
 *
 * @example
 * ```ts
 * import { Context, Layer } from 'effect'
 * import { declareLayer } from '@sleekstack/core'
 *
 * class Config extends Context.Tag('Config')<Config, { url: string }>() {}
 * const ConfigLayer = declareLayer(Layer.succeed(Config, { url: 'http://localhost' }), { lifetime: 'app' })
 * ```
 */
export function declareLayer<ROut, E, RIn>(
  layer: Layer.Layer<ROut, E, RIn>,
  options: { readonly lifetime?: Lifetime; /** @internal */ readonly attribute?: false } = {},
): DeclaredLayer {
  if (!Layer.isLayer(layer)) throw new InvalidModule({ message: 'declareLayer(): expected an Effect Layer' })
  return {
    _tag: 'DeclaredLayer',
    layer,
    ...(options.lifetime && { lifetime: options.lifetime }),
    ...(options.attribute === false && { attribute: false as const }),
  }
}

const isTagged = (x: unknown, tag: string): boolean =>
  typeof x === 'object' && x !== null && (x as { _tag?: unknown })._tag === tag

const isTagArray = (x: unknown): boolean => Array.isArray(x) && x.every((t) => Context.isTag(t))

/** Structural check for a tagged entry, so malformed values fail in module(), not at scope build. */
function entryProblem(e: unknown): string | undefined {
  if (isDeclaredLayer(e)) {
    return Layer.isLayer(e.layer) ? undefined : 'is a malformed declared Layer'
  }
  return Layer.isLayer(e) ? undefined : 'is not a declared Layer or Layer'
}

export const isModule = (x: unknown): x is Module => isTagged(x, 'Module')
export const isDeclaredLayer = (x: unknown): x is DeclaredLayer => isTagged(x, 'DeclaredLayer')

/**
 * Creates a module. Only the module's own structure is validated here; whole-graph checks
 * (cycles, duplicate names, dependencies, privacy) happen only in `sleekstack check`; the runtime builds entries in position order.
 *
 * @param config - `name` (non-empty), `entries`, `imports`, `exports` (omit: all Tags public), `lifetime` (default for entries without one).
 * @returns The module.
 * @throws {@link InvalidModule} `InvalidModule` when `name` is empty, an entry is malformed, or `entries`/`imports`/`exports` have the wrong shape.
 *
 * @example
 * ```ts
 * import { Context, Layer } from 'effect'
 * import { declareLayer, module } from '@sleekstack/core'
 *
 * class Clock extends Context.Tag('Clock')<Clock, { now(): number }>() {}
 * const ClockModule = module({
 *   name: 'clock',
 *   entries: [declareLayer(Layer.succeed(Clock, { now: () => Date.now() }))],
 *   exports: [Clock],
 * })
 * ```
 */
function makeModule(config: {
  readonly name: string
  readonly entries?: readonly Entry[]
  readonly imports?: Imports
  readonly exports?: readonly AnyTag[]
  readonly lifetime?: Lifetime
}): Module {
  const { name } = config
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new InvalidModule({ message: `module(): 'name' must be a non-empty string, got: ${JSON.stringify(name)}` })
  }
  const entries = config.entries ?? []
  if (!Array.isArray(entries))
    throw new InvalidModule({ name, message: `module("${name}"): 'entries' must be an array` })
  entries.forEach((e, i) => {
    const problem = entryProblem(e)
    if (problem) throw new InvalidModule({ name, message: `module("${name}"): entry ${i} ${problem}` })
  })
  if (config.exports !== undefined && !isTagArray(config.exports)) {
    throw new InvalidModule({ name, message: `module("${name}"): 'exports' must be an array of Tags` })
  }
  const imports = config.imports ?? []
  if (typeof imports !== 'function' && !Array.isArray(imports)) {
    throw new InvalidModule({ name, message: `module("${name}"): 'imports' must be an array or a thunk` })
  }
  return {
    _tag: 'Module',
    name,
    entries,
    imports,
    ...(config.exports !== undefined && { exports: config.exports }),
    ...(config.lifetime && { lifetime: config.lifetime }),
  }
}

// Not declared as `function module`: that would shadow the CommonJS `module` that webpack Fast Refresh reads (`module.hot`).
export { makeModule as module }
