/**
 * packages/core/src/graph.ts
 *
 * buildGraph: the single whole-graph validation entry. Walks modules (identity
 * cycles, duplicate names, diamond dedupe), flattens entries with provenance,
 * resolves shadowing by locality, checks dependencies and ordering, and only
 * then composes Layers. snapshot() turns the result into a JSON-safe DTO.
 */

import { Cause, Context, Layer } from 'effect'
import { walkModules } from './cycle'
import { AmbiguousProvider, DependencyCycle, MissingDependency, PrivateDependency } from './errors'
import { isDeclaredLayer, isModule, isServiceDefinition, type Entry, type Module } from './module'
import { checkLifetimes } from './lifetime'
import type { Lifetime } from './service'

type AnyLayer = Layer.Layer<any, any, any>

/** One validated node of a {@link Graph}: a service, declared Layer, or bare Layer, with its provenance. */
export interface GraphNode {
  readonly id: string
  readonly provides: readonly string[]
  readonly requires: readonly string[]
  readonly lifetime: Lifetime
  readonly module: Module | undefined
  readonly paths: readonly (readonly string[])[]
  readonly opaque: boolean
  readonly private: boolean
  /** Import depth: 0 = passed directly to buildGraph; lower wins. */
  readonly depth: number
  /** Tags this node declares but lost to a more local provider (built, not exposed). */
  readonly lost: readonly string[]
  readonly layer: AnyLayer
}

/** A Tag provided by several entries, and which one won by locality (the rest are shadowed). */
export interface Shadowing {
  readonly tag: string
  readonly winner: string
  readonly shadowed: readonly string[]
}

/** The validated module graph returned by {@link buildGraph}, with its composed Layer. */
export interface Graph {
  /** Winning, metadata-carrying nodes in construction order. */
  readonly nodes: readonly GraphNode[]
  /** Bare raw Layers: opaque, merged into a base built first. */
  readonly opaque: readonly GraphNode[]
  /** Nodes that lost every Tag they provide to a more local entry. */
  readonly shadowed: readonly GraphNode[]
  readonly shadowing: readonly Shadowing[]
  /** Resolved dependency edges between live nodes (to = the winning provider). */
  readonly edges: readonly { readonly from: string; readonly to: string; readonly tag: string }[]
  /** Everything composed: base first, then nodes in order. */
  readonly layer: Layer.Layer<any, any, never>
}

/** A JSON-safe view of a {@link Graph} (one node per provided Tag), for devtools and visualizers. */
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
  readonly shadowing: readonly Shadowing[]
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

const where = (n: GraphNode) => (n.module ? `module "${n.module.name}"` : 'root entries')

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
  readonly live: readonly GraphNode[]
  readonly opaque: readonly GraphNode[]
  readonly shadowed: readonly GraphNode[]
  readonly shadowing: readonly Shadowing[]
  readonly winners: ReadonlyMap<string, GraphNode>
}

/**
 * Module walk, node creation, and per-Tag shadowing by locality (steps 1-3 of buildGraph).
 * Also resolves child-boundary entries (nested React providers, Next per-operation provide).
 */
export function resolveEntries(input: readonly (Module | Entry)[]): Resolved {
  // 1. Modules: identity walk; direct (non-module) inputs are depth 0.
  const visits = walkModules(input.filter(isModule))
  type Seen = { entry: Entry; module: Module | undefined; depth: number; paths: string[][] }
  const seen = new Map<Entry, Seen>()
  const add = (entry: Entry, module: Module | undefined, depth: number, paths: string[][]) => {
    const prev = seen.get(entry)
    if (!prev) return void seen.set(entry, { entry, module, depth, paths: [...paths] })
    prev.paths.push(...paths) // diamond: same entry object counts once
    if (depth < prev.depth) Object.assign(prev, { module, depth })
  }
  for (const e of input) if (!isModule(e)) add(e, undefined, 0, [[]])
  for (const v of visits.values()) for (const e of v.module.entries) add(e, v.module, v.depth, v.paths)

  // 2. Nodes.
  let opaqueN = 0
  const all: GraphNode[] = [...seen.values()].map(({ entry, module, depth, paths }) => {
    const base = { module, depth, paths, lost: [] }
    const isPrivate = (provides: readonly string[]) => provides.every((k) => isPrivateTag(module, k))
    if (isServiceDefinition(entry)) {
      const provides = [entry.tag.key]
      return {
        ...base, id: entry.tag.key, provides, requires: entry.requires.map((t) => t.key),
        lifetime: entry.explicitLifetime ? entry.lifetime : (module?.lifetime ?? 'app'),
        opaque: false, private: isPrivate(provides), layer: entry.layer,
      }
    }
    if (isDeclaredLayer(entry)) {
      const provides = entry.provides.map((t) => t.key)
      return {
        ...base, id: provides.join('+'), provides, requires: entry.requires.map((t) => t.key),
        lifetime: entry.lifetime ?? module?.lifetime ?? 'app',
        opaque: false, private: isPrivate(provides), layer: attributed(entry.layer, module),
      }
    }
    return {
      ...base, id: `opaque:${module?.name ?? 'root'}#${opaqueN++}`, provides: [], requires: [],
      lifetime: module?.lifetime ?? 'app', opaque: true, private: module !== undefined, layer: attributed(entry as AnyLayer, module),
    }
  })

  // 3. Per-Tag shadowing by locality; same Tag at the same (best) depth -> ambiguous.
  const byTag = new Map<string, GraphNode[]>()
  for (const n of all) for (const k of n.provides) byTag.set(k, [...(byTag.get(k) ?? []), n])
  const won = new Map<string, GraphNode>()
  const shadowing: Shadowing[] = []
  for (const [tag, ns] of byTag) {
    const best = Math.min(...ns.map((n) => n.depth))
    const top = ns.filter((n) => n.depth === best)
    if (top.length > 1) {
      const modules = top.map((n) => n.module?.name ?? '(root)')
      throw new AmbiguousProvider({
        tag, modules,
        message: `Tag "${tag}" is provided by several entries at the same precedence: ${top.map(where).join(', ')}`,
      })
    }
    won.set(tag, top[0]!)
    const losers = ns.filter((n) => n !== top[0])
    if (losers.length) shadowing.push({ tag, winner: tag, shadowed: losers.map((n) => shadowedId(tag, n)) })
  }
  // A declared Layer that won only some of its Tags is still built once, exposing only the Tags it won.
  const live: GraphNode[] = []
  const shadowed: GraphNode[] = []
  const winners = new Map<string, GraphNode>()
  for (const n of all) {
    if (n.opaque) continue
    const mine = n.provides.filter((k) => won.get(k) === n)
    if (mine.length === 0) {
      shadowed.push(n)
      continue
    }
    const node = mine.length === n.provides.length
      ? n
      : { ...n, provides: mine, lost: n.provides.filter((k) => !mine.includes(k)), layer: only(n.layer, mine) }
    live.push(node)
    for (const k of mine) winners.set(k, node)
  }
  return { live, opaque: all.filter((n) => n.opaque), shadowed, shadowing, winners }
}

const shadowedId = (tag: string, n: GraphNode) => `${tag}@${n.module?.name ?? '(root)'}`

/**
 * Validates a whole module graph and composes its Layer. This is the single whole-graph
 * validation entry: module walk, shadowing by locality, dependencies, privacy, lifetimes, ordering.
 * No service is constructed.
 *
 * @param input - Root modules and/or entries (depth 0, most local).
 * @returns The validated graph.
 * @throws {@link ModuleCycle} `ModuleCycle` when modules import each other in a cycle.
 * @throws {@link DuplicateModule} `DuplicateModule` when two distinct modules share a name.
 * @throws {@link InvalidModule} `InvalidModule` when a module imports a non-module value.
 * @throws {@link AmbiguousProvider} `AmbiguousProvider` when a Tag has several providers at the same locality.
 * @throws {@link MissingDependency} `MissingDependency` when a required Tag has no provider.
 * @throws {@link PrivateDependency} `PrivateDependency` when a Tag private to a module is required from outside it.
 * @throws {@link CaptiveDependency} `CaptiveDependency` when a service depends on one with an incompatible lifetime.
 * @throws {@link DependencyCycle} `DependencyCycle` when services require each other in a cycle.
 *
 * @example
 * ```ts
 * import { Context, Effect } from 'effect'
 * import { buildGraph, module, service } from '@sleekstack/core'
 *
 * class Clock extends Context.Tag('Clock')<Clock, { now(): number }>() {}
 * const App = module({ name: 'app', entries: [service(Clock, {}, () => Effect.succeed({ now: () => Date.now() }))] })
 * const graph = buildGraph([App])
 * ```
 */
export function buildGraph(input: readonly (Module | Entry)[]): Graph {
  const { live, opaque, shadowed, shadowing, winners } = resolveEntries(input)

  // 4. Dependencies (bare Layers cannot satisfy them: their outputs are invisible).
  for (const n of live) {
    for (const r of n.requires) {
      if (!winners.has(r)) {
        throw new MissingDependency({
          service: n.id, missing: r, ...(n.module && { module: n.module.name }),
          message:
            `Service "${n.id}" (${where(n)}) requires "${r}", but no entry provides it. ` +
            `If a raw Layer provides it, wrap it with declareLayer(layer, { provides: [...] }).`,
        })
      }
      const owner = winners.get(r)!.module
      if (owner && owner !== n.module && isPrivateTag(owner, r)) throw privateDependency(r, owner, n.id)
    }
  }
  checkLifetimes(live, (k) => winners.get(k)!)
  const ordered = toposort(live, (k) => winners.get(k)!)

  // 5. Compose: bare Layers first as a base, then nodes in order. No construction happens here.
  let acc: AnyLayer = opaque.length ? Layer.mergeAll(...(opaque.map((n) => n.layer) as [AnyLayer])) : (Layer.empty as unknown as AnyLayer)
  for (const n of ordered) acc = n.layer.pipe(Layer.provideMerge(acc))
  // Edge endpoints are Tag keys: the snapshot keys every provided Tag as its own node.
  const edges = ordered.flatMap((n) => n.provides.flatMap((from) => n.requires.map((tag) => ({ from, to: tag, tag }))))
  return { nodes: ordered, opaque, shadowed, shadowing, edges, layer: acc as Layer.Layer<any, any, never> }
}

/** Kahn ordering, dependencies first. `provider` maps a required Tag key to its node. Throws DependencyCycle. */
export function toposort<N extends { readonly id: string; readonly requires: readonly string[] }>(
  nodes: readonly N[],
  provider: (key: string) => N,
): N[] {
  const indegree = new Map<N, number>()
  const dependents = new Map<N, N[]>()
  for (const n of nodes) {
    const deps = new Set(n.requires.map(provider))
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

  // Leftover nodes sit on or behind a cycle: follow requires edges among them until a repeat.
  const left = new Set(nodes.filter((n) => indegree.get(n)! > 0))
  const path: N[] = []
  let cur = [...left][0]!
  while (!path.includes(cur)) {
    path.push(cur)
    cur = cur.requires.map(provider).find((d) => left.has(d))!
  }
  const cycle = [...path.slice(path.indexOf(cur)), cur].map((n) => n.id)
  throw new DependencyCycle({ path: cycle, message: `Dependency cycle: ${cycle.join(' -> ')}` })
}

/**
 * Turns a graph into a JSON-safe snapshot: one node per provided Tag (`Tag@Module` when shadowed).
 *
 * @param graph - A graph from {@link buildGraph}.
 * @returns The snapshot.
 *
 * @example
 * ```ts
 * import { buildGraph, snapshot } from '@sleekstack/core'
 *
 * const json = JSON.stringify(snapshot(buildGraph([])))
 * ```
 */
export function snapshot(graph: Graph): GraphSnapshot {
  // One DTO per provided Tag (canonical key; `Tag@Module` when shadowed), so multi-Tag
  // declared Layers get collision-free ids and per-Tag privacy.
  const dto = (n: GraphNode, tag: string | undefined, shadowed: boolean) => ({
    id: tag === undefined ? n.id : shadowed ? shadowedId(tag, n) : tag,
    name: tag ?? n.id,
    provides: tag === undefined ? [] : [tag],
    lifetime: n.lifetime,
    module: n.module ? { id: n.module.name, name: n.module.name } : null,
    paths: n.paths.map((p) => [...p]),
    private: tag === undefined ? n.private : isPrivateTag(n.module, tag),
    opaque: n.opaque,
    shadowed,
  })
  return {
    nodes: [
      ...graph.opaque.map((n) => dto(n, undefined, false)),
      ...graph.nodes.flatMap((n) => n.provides.map((k) => dto(n, k, false))),
      ...graph.nodes.flatMap((n) => n.lost.map((k) => dto(n, k, true))),
      ...graph.shadowed.flatMap((n) => n.provides.map((k) => dto(n, k, true))),
    ],
    edges: graph.edges.map((e) => ({ ...e })),
    shadowing: graph.shadowing.map((s) => ({ ...s, shadowed: [...s.shadowed] })),
  }
}
