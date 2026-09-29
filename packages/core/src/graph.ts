/**
 * packages/core/src/graph.ts
 *
 * Internal resolution: module walk (identity cycles, duplicate names, diamond dedupe), entries
 * flattened with provenance, per-Tag shadowing by locality, dependency ordering. `buildPlan` is the
 * root path (vetted statically by the analyzer, so it validates nothing); child boundaries use the
 * throwing `resolveEntries` / `toposort` (per-call entries cannot be seen statically).
 */

import { Cause, Context, Layer } from 'effect'
import { walkModules } from './cycle'
import { AmbiguousProvider, DependencyCycle, PrivateDependency } from './errors'
import { isDeclaredLayer, isModule, isServiceDefinition, type Entry, type Module } from './module'
import type { Lifetime } from './service'

type AnyLayer = Layer.Layer<any, any, any>

/** One resolved node: a service, declared Layer, or bare Layer, with its provenance. */
export interface PlanNode {
  readonly id: string
  readonly provides: readonly string[]
  readonly requires: readonly string[]
  readonly lifetime: Lifetime
  readonly module: Module | undefined
  readonly opaque: boolean
  /** Import depth: 0 = passed directly as input; lower wins. */
  readonly depth: number
  readonly layer: AnyLayer
}

/**
 * Traversal only, for adapter-side provide-set checks: visits every Tag a provide set reaches (entry provides and requires,
 * module exports), with its owning module (`undefined` for direct entries). Follows `imports`
 * (arrays and thunks) and visits each module once by identity, so cycles are skipped, not thrown.
 * No validation.
 *
 * @param input - Root modules and/or entries.
 * @param visit - Called once per reached Tag occurrence.
 *
 * @example
 * ```ts
 * import { Context } from 'effect'
 * import { module, walkProvide } from '@sleekstack/core'
 *
 * class Clock extends Context.Tag('Clock')<Clock, number>() {}
 * walkProvide([module({ name: 'app', exports: [Clock] })], (tag, mod) => console.log(tag.key, mod?.name))
 * ```
 *
 * @internal
 */
export function walkProvide(input: readonly (Module | Entry)[], visit: (tag: Context.Tag<any, any>, module: Module | undefined) => void): void {
  const seen = new Set<Module>()
  const entry = (e: Entry, m: Module | undefined) => {
    if (isServiceDefinition(e)) [e.tag, ...e.requires].forEach((t) => visit(t, m))
    else if (isDeclaredLayer(e)) [...e.provides, ...e.requires].forEach((t) => visit(t, m))
  }
  const walk = (x: Module | Entry) => {
    if (!isModule(x)) return entry(x, undefined)
    if (seen.has(x)) return
    seen.add(x)
    x.entries.forEach((e) => entry(e, x))
    x.exports?.forEach((t) => visit(t, x))
    let imports: readonly unknown[]
    try {
      imports = typeof x.imports === 'function' ? x.imports() : x.imports
    } catch {
      return // a thunk not yet resolvable is reported when the scope resolves it
    }
    imports.forEach((i) => isModule(i) && walk(i))
  }
  input.forEach(walk)
}

/** A Tag is private when its module lists `exports` and the Tag is not among them. */
export const isPrivateTag = (module: Module | undefined, key: string): boolean =>
  module?.exports !== undefined && !module.exports.some((t) => t.key === key)

/** @internal */
export const privateDependency = (tag: string, module: Module, requiredBy: string) =>
  new PrivateDependency({
    tag, module: module.name, requiredBy,
    message: `"${requiredBy}" requires "${tag}", which is private to module "${module.name}" (not in its exports)`,
  })

const where = (n: PlanNode) => (n.module ? `module "${n.module.name}"` : 'root entries')

/** Raw-Layer construction failures carry the owning module's name; the original Cause is kept as `cause`. */
const attributed = (layer: AnyLayer, module: Module | undefined): AnyLayer =>
  module === undefined
    ? layer
    : Layer.catchAllCause(layer, (cause) =>
        Layer.failCause(Cause.die(new Error(`Raw Layer in module "${module.name}" failed to build: ${Cause.squash(cause)}`, { cause }))),
      )

/** Only `keys` of a Layer's outputs: a partially shadowed declared Layer must not overwrite local winners. */
const only = (layer: AnyLayer, keys: readonly string[]): AnyLayer =>
  Layer.map(layer, (ctx) => Context.unsafeMake(new Map([...ctx.unsafeMap].filter(([k]) => keys.includes(k)))))

export interface Resolved {
  /** Metadata-carrying nodes winning at least one Tag; `provides` lists only the Tags they won. */
  readonly live: readonly PlanNode[]
  readonly opaque: readonly PlanNode[]
  readonly winners: ReadonlyMap<string, PlanNode>
}

/**
 * Module walk, node creation, and per-Tag shadowing by locality. `strict` (child-boundary entries:
 * nested React providers, Next per-operation provide) throws AmbiguousProvider for a Tag with several
 * providers at the best locality; otherwise the first listed wins (the analyzer reports it).
 */
export function resolveEntries(input: readonly (Module | Entry)[], strict = true): Resolved {
  // 1. Modules: identity walk; direct (non-module) inputs are depth 0.
  const visits = walkModules(input.filter(isModule))
  type Seen = { entry: Entry; module: Module | undefined; depth: number }
  const seen = new Map<Entry, Seen>()
  const add = (entry: Entry, module: Module | undefined, depth: number) => {
    const prev = seen.get(entry) // diamond: same entry object counts once
    if (!prev) seen.set(entry, { entry, module, depth })
    else if (depth < prev.depth) Object.assign(prev, { module, depth })
  }
  for (const e of input) if (!isModule(e)) add(e, undefined, 0)
  for (const v of visits.values()) for (const e of v.module.entries) add(e, v.module, v.depth)

  // 2. Nodes.
  let opaqueN = 0
  const all: PlanNode[] = [...seen.values()].map(({ entry, module, depth }) => {
    const base = { module, depth }
    if (isServiceDefinition(entry)) {
      const provides = [entry.tag.key]
      return {
        ...base, id: entry.tag.key, provides, requires: entry.requires.map((t) => t.key),
        lifetime: entry.explicitLifetime ? entry.lifetime : (module?.lifetime ?? 'app'),
        opaque: false, layer: entry.layer,
      }
    }
    if (isDeclaredLayer(entry)) {
      const provides = entry.provides.map((t) => t.key)
      return {
        ...base, id: provides.join('+'), provides, requires: entry.requires.map((t) => t.key),
        lifetime: entry.lifetime ?? module?.lifetime ?? 'app',
        opaque: false, layer: attributed(entry.layer, module),
      }
    }
    return {
      ...base, id: `opaque:${module?.name ?? 'root'}#${opaqueN++}`, provides: [], requires: [],
      lifetime: module?.lifetime ?? 'app', opaque: true, layer: attributed(entry as AnyLayer, module),
    }
  })

  // 3. Per-Tag shadowing by locality; same Tag at the same (best) depth -> ambiguous.
  const byTag = new Map<string, PlanNode[]>()
  for (const n of all) for (const k of n.provides) byTag.set(k, [...(byTag.get(k) ?? []), n])
  const won = new Map<string, PlanNode>()
  for (const [tag, ns] of byTag) {
    const best = Math.min(...ns.map((n) => n.depth))
    const top = ns.filter((n) => n.depth === best)
    if (strict && top.length > 1) {
      const modules = top.map((n) => n.module?.name ?? '(root)')
      throw new AmbiguousProvider({
        tag, modules,
        message: `Tag "${tag}" is provided by several entries at the same precedence: ${top.map(where).join(', ')}`,
      })
    }
    won.set(tag, top[0]!)
  }
  // A declared Layer that won only some of its Tags is still built once, exposing only the Tags it won.
  const live: PlanNode[] = []
  const winners = new Map<string, PlanNode>()
  for (const n of all) {
    if (n.opaque) continue
    const mine = n.provides.filter((k) => won.get(k) === n)
    if (mine.length === 0) continue
    const node = mine.length === n.provides.length
      ? n
      : { ...n, provides: mine, layer: only(n.layer, mine) }
    live.push(node)
    for (const k of mine) winners.set(k, node)
  }
  return { live, opaque: all.filter((n) => n.opaque), winners }
}

/** The root resolution: winning nodes in construction order, plus opaque bare Layers. */
export interface ResolutionPlan {
  readonly nodes: readonly PlanNode[]
  readonly opaque: readonly PlanNode[]
}

/**
 * Resolves root entries without validating them: missing, private, captive, cycle and ambiguity
 * checks belong to the analyzer (`sleekstack check`); the scope runtime keeps its resolve-time backstops.
 */
export function buildPlan(input: readonly (Module | Entry)[]): ResolutionPlan {
  const { live, opaque, winners } = resolveEntries(input, false)
  return { nodes: toposort(live, (k) => winners.get(k), false), opaque }
}

/**
 * Kahn ordering, dependencies first. `provider` maps a required Tag key to its node (unknown keys are
 * ignored). `strict` throws DependencyCycle; otherwise cyclic nodes follow in input order (the lazy
 * build then fails with DependencyCycle when it re-enters one).
 */
export function toposort<N extends { readonly id: string; readonly requires: readonly string[] }>(
  nodes: readonly N[],
  provider: (key: string) => N | undefined,
  strict = true,
): N[] {
  const indegree = new Map<N, number>()
  const dependents = new Map<N, N[]>()
  for (const n of nodes) {
    const deps = new Set(n.requires.map(provider).filter((d): d is N => d !== undefined))
    indegree.set(n, deps.size)
    for (const d of deps) dependents.set(d, [...(dependents.get(d) ?? []), n])
  }
  const queue = nodes.filter((n) => indegree.get(n) === 0)
  const out: N[] = []
  for (let n = queue.shift(); n !== undefined; n = queue.shift()) {
    out.push(n)
    for (const dep of dependents.get(n) ?? []) {
      const c = indegree.get(dep)! - 1
      indegree.set(dep, c)
      if (c === 0) queue.push(dep)
    }
  }
  if (out.length === nodes.length) return out
  if (!strict) return [...out, ...nodes.filter((n) => !out.includes(n))]

  // Leftover nodes sit on or behind a cycle: follow requires edges among them until a repeat.
  const left = new Set(nodes.filter((n) => indegree.get(n)! > 0))
  const path: N[] = []
  let cur = [...left][0]!
  while (!path.includes(cur)) {
    path.push(cur)
    cur = cur.requires.map(provider).find((d): d is N => d !== undefined && left.has(d))!
  }
  const cycle = [...path.slice(path.indexOf(cur)), cur].map((n) => n.id)
  throw new DependencyCycle({ path: cycle, message: `Dependency cycle: ${cycle.join(' -> ')}` })
}
