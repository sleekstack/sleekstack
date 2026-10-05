/**
 * packages/kit/src/module.ts
 *
 * `module()` lowers to core `module()`. `validateProvide()` is the per-provide-set
 * DuplicateTag check. Whole-graph checks are the analyzer's (`sleekstack check`).
 */

import { module as coreModule, type Entry, type Module as CoreModule } from '@sleekstack/core'
import { normalize, SleekStackError } from './errors'
import { layerInfo, type Layer, type LayerInfo } from './layer'
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
  if (!info)
    throw new SleekStackError('InvalidModule', `module("${owner}") imports a non-module value`, { name: owner })
  return info.core
}

/**
 * Layers in dependency order: a layer follows the same-list layers that provide its `deps` tags.
 * Core builds by position, so this makes list order irrelevant for array deps. Generator layers
 * declare no deps (the analyzer reads their yields), so they keep their listed place; a cycle
 * keeps its listed order (the analyzer reports it).
 */
function orderByDeps(infos: readonly LayerInfo[]): LayerInfo[] {
  const provider = new Map(infos.map((i) => [coreTag(i.tag).key, i]))
  const seen = new Set<LayerInfo>()
  const out: LayerInfo[] = []
  const visit = (i: LayerInfo) => {
    if (seen.has(i)) return
    seen.add(i)
    for (const d of i.deps) {
      const p = provider.get(coreTag(d).key)
      if (p) visit(p)
    }
    out.push(i)
  }
  infos.forEach(visit)
  return out
}

/**
 * Creates a module. Whole-graph checks run in `sleekstack check`; a provider or runtime resolves it without them.
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
function makeModule(config: ModuleConfig): Module {
  try {
    const name = config?.name
    const provide = config.provide ?? []
    if (!Array.isArray(provide))
      throw new SleekStackError('InvalidModule', `module("${name}"): 'provide' must be an array`, { name })
    const entries = orderByDeps(
      provide.map((l, i) => {
        const info = layerInfo(l)
        if (!info)
          throw new SleekStackError('InvalidModule', `module("${name}"): provide ${i} is not a layer()`, { name })
        return info
      }),
    ).map((i) => i.def)
    const imports = config.imports ?? []
    const core = coreModule({
      name,
      entries,
      imports:
        typeof imports === 'function'
          ? () => imports().map((m) => coreModuleOf(m, name))
          : Array.isArray(imports)
            ? imports.map((m) => coreModuleOf(m, name))
            : (imports as never),
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
  const mapped = items.map((x) => {
    const m = moduleInfo(x)
    if (m) return m.core
    const l = layerInfo(x)
    if (l) return l
    throw new SleekStackError('InvalidModule', `Expected a layer() or module(), got: ${String(x)}`)
  })
  const sorted = orderByDeps(mapped.filter((x): x is LayerInfo => 'def' in x)).map((i) => i.def)
  return mapped.map((x) => ('def' in x ? sorted.shift()! : x))
}

/**
 * @internal Throws DuplicateTag when one provide set (with its transitive imports and every
 * Layer's deps) holds two distinct Tag objects with the same key. Never compares across sets.
 */
export function validateProvide(items: readonly (Layer<any> | Module)[]): void {
  unwrap(items) // InvalidModule for anything that is not a layer() or module()
  const byKey = new Map<string, object>()
  const seen = new Set<object>()
  const visit = (t: AnyTag) => {
    const c = coreTag(t)
    const prev = byKey.get(c.key)
    if (prev === undefined) byKey.set(c.key, c)
    else if (prev !== c) {
      throw new SleekStackError('DuplicateTag', `Two distinct Tags share the key "${c.key}" in one provide set`, {
        tag: c.key,
      })
    }
  }
  const walk = (x: Layer<any> | Module): void => {
    const m = moduleInfo(x)
    if (!m) {
      const l = layerInfo(x)
      return l && [l.tag, ...l.deps].forEach(visit)
    }
    if (seen.has(x)) return
    seen.add(x)
    m.config.provide?.forEach(walk)
    m.config.exports?.forEach(visit)
    const imports = m.config.imports ?? []
    let list: readonly Module[]
    try {
      list = typeof imports === 'function' ? imports() : imports
    } catch {
      return // a thunk not yet resolvable is reported when the scope resolves it
    }
    list.forEach(walk)
  }
  items.forEach(walk)
}

// Not declared as `function module`: that would shadow the CommonJS `module` that webpack Fast Refresh reads (`module.hot`).
export { makeModule as module }
