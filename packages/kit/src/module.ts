/**
 * packages/kit/src/module.ts
 *
 * `module()` lowers to core `module()`. `validateProvide()` is the per-provide-set
 * DuplicateTag check; `snapshot()` delegates to core `snapshot(buildGraph(...))`.
 */

import { buildGraph, module as coreModule, snapshot as coreSnapshot, type Entry, type Module as CoreModule } from '@sleekstack/core'
import { normalize, SleekStackError } from './errors'
import { layerInfo, type Layer, type Lifetime } from './layer'
import { coreTag, keyOf, type AnyTag } from './tag'

declare const ModuleBrand: unique symbol

export interface Module {
  readonly name: string
  readonly [ModuleBrand]: true
}

export type Imports = readonly Module[] | (() => readonly Module[])

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
  const byKey = new Map<string, AnyTag>()
  const see = (t: AnyTag) => {
    const key = keyOf(t)
    const prev = byKey.get(key)
    if (prev === undefined) byKey.set(key, t)
    else if (prev !== t) {
      throw new SleekStackError('DuplicateTag', `Two distinct Tags share the key "${key}" in one provide set`, { tag: key })
    }
  }
  const visited = new Set<object>()
  const walk = (x: unknown) => {
    const l = layerInfo(x)
    if (l) return void [l.tag, ...l.deps].forEach(see)
    const m = moduleInfo(x)
    if (!m || visited.has(x as object)) return
    visited.add(x as object)
    ;(m.config.provide ?? []).forEach(walk)
    ;(m.config.exports ?? []).forEach(see)
    const imports = m.config.imports ?? []
    ;(typeof imports === 'function' ? imports() : imports).forEach(walk)
  }
  items.forEach(walk)
}

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

/** Builds and validates the graph of `app`, returning core's JSON-safe snapshot. */
export function snapshot(app: Module): GraphSnapshot {
  try {
    validateProvide([app])
    return coreSnapshot(buildGraph(unwrap([app])))
  } catch (e) {
    throw normalize(e)
  }
}
