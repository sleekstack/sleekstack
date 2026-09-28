/**
 * packages/kit/src/module.ts
 *
 * `module()` lowers to core `module()`. `validateProvide()` is the per-provide-set
 * DuplicateTag check; `snapshot()` delegates to core `snapshot(buildGraph(...))`.
 */

import { buildGraph, walkProvide, module as coreModule, snapshot as coreSnapshot, type Entry, type Module as CoreModule } from '@sleekstack/core'
import { normalize, SleekStackError } from './errors'
import { layerInfo, type Layer, type Lifetime } from './layer'
import { coreTag, type AnyTag } from './tag'

declare const ModuleBrand: unique symbol

/** A named group of Layers created by {@link module}. */
export interface Module {
  readonly name: string
  readonly [ModuleBrand]: true
}

/** A module's imports: a list, or a thunk returning one. */
export type Imports = readonly Module[] | (() => readonly Module[])

/** Config for {@link module}: `name`, `provide` (Layers), `imports`, and `exports` (omit: every Tag is public). */
export interface ModuleConfig {
  readonly name: string
  readonly provide?: readonly Layer<any>[]
  readonly imports?: Imports
  readonly exports?: readonly AnyTag[]
}

interface ModuleInfo {
  readonly config: ModuleConfig
  readonly core: CoreModule
}

const infos = new WeakMap<object, ModuleInfo>()

const moduleInfo = (x: unknown): ModuleInfo | undefined =>
  typeof x === 'object' && x !== null ? infos.get(x) : undefined

const coreModuleOf = (m: unknown, owner: string): CoreModule => {
  const info = moduleInfo(m)
  if (!info) throw new SleekStackError('InvalidModule', `module("${owner}") imports a non-module value`, { name: owner })
  return info.core
}

/**
 * Creates a module. Whole-graph checks run later, when a provider or runtime builds it (or in {@link snapshot}).
 *
 * @param config - `name`, `provide`, `imports`, and `exports`.
 * @returns The module.
 * @throws {@link SleekStackError} with code `InvalidModule` when `name` is empty, `provide` holds a non-`layer()` value, or `imports`/`exports` are malformed.
 *
 * @example
 * ```ts
 * import { layer, module, tag } from '@sleekstack/kit'
 *
 * interface Clock { now(): number }
 * const Clock = tag<Clock>('Clock')
 * export const ClockModule = module({ name: 'clock', provide: [layer(Clock, { now: () => Date.now() })], exports: [Clock] })
 * ```
 */
export function module(config: ModuleConfig): Module {
  try {
    const name = config?.name
    const provide = config.provide ?? []
    if (!Array.isArray(provide)) throw new SleekStackError('InvalidModule', `module("${name}"): 'provide' must be an array`, { name })
    const entries = provide.map((l, i) => {
      const info = layerInfo(l)
      if (!info) throw new SleekStackError('InvalidModule', `module("${name}"): provide ${i} is not a layer()`, { name })
      return info.def
    })
    const imports = config.imports ?? []
    const core = coreModule({
      name,
      entries,
      imports: typeof imports === 'function' ? () => imports().map((m) => coreModuleOf(m, name)) : Array.isArray(imports) ? imports.map((m) => coreModuleOf(m, name)) : (imports as never),
      ...(config.exports !== undefined && { exports: config.exports.map(coreTag) }),
    })
    const m = Object.freeze({ name }) as Module
    infos.set(m, { config, core })
    return m
  } catch (e) {
    throw normalize(e, 'InvalidModule')
  }
}

/** @internal Lowers kit provide-set members to core graph input. */
export function unwrap(items: readonly (Layer<any> | Module)[]): (Entry | CoreModule)[] {
  return items.map((x) => {
    const m = moduleInfo(x)
    if (m) return m.core
    const l = layerInfo(x)
    if (l) return l.def
    throw new SleekStackError('InvalidModule', `Expected a layer() or module(), got: ${String(x)}`)
  })
}

/**
 * @internal Throws DuplicateTag when one provide set (with its transitive imports and every
 * Layer's deps) holds two distinct Tag objects with the same key. Never compares across sets.
 */
export function validateProvide(items: readonly (Layer<any> | Module)[]): void {
  const byKey = new Map<string, object>()
  walkProvide(unwrap(items), (t) => {
    const prev = byKey.get(t.key)
    if (prev === undefined) byKey.set(t.key, t)
    else if (prev !== t) {
      throw new SleekStackError('DuplicateTag', `Two distinct Tags share the key "${t.key}" in one provide set`, { tag: t.key })
    }
  })
}

/** The JSON-safe graph returned by {@link snapshot}: one node per provided Tag, plus edges and shadowing. */
export interface GraphSnapshot {
  readonly nodes: readonly {
    readonly id: string
    readonly name: string
    readonly provides: readonly string[]
    readonly lifetime: Lifetime
    readonly module: { readonly id: string; readonly name: string } | null
    readonly paths: readonly (readonly string[])[]
    readonly private: boolean
    readonly opaque: boolean
    readonly shadowed: boolean
  }[]
  readonly edges: readonly { readonly from: string; readonly to: string; readonly tag: string }[]
  readonly shadowing: readonly { readonly tag: string; readonly winner: string; readonly shadowed: readonly string[] }[]
}

/**
 * Builds and validates the graph of `app`, returning a JSON-safe snapshot. No service is constructed.
 *
 * @param app - The root module.
 * @returns The graph snapshot.
 * @throws {@link SleekStackError} with code `DuplicateTag` when two distinct Tags share a key.
 * @throws {@link SleekStackError} with a graph code (`MissingDependency`, `DependencyCycle`, `AmbiguousProvider`, `ModuleCycle`, `DuplicateModule`, `InvalidModule`, `CaptiveDependency`, `PrivateDependency`) when validation fails.
 *
 * @example
 * ```ts
 * import { module, snapshot } from '@sleekstack/kit'
 *
 * const graph = snapshot(module({ name: 'app' }))
 * console.log(graph.nodes.length)
 * ```
 */
export function snapshot(app: Module): GraphSnapshot {
  try {
    validateProvide([app])
    return coreSnapshot(buildGraph(unwrap([app])))
  } catch (e) {
    throw normalize(e)
  }
}
