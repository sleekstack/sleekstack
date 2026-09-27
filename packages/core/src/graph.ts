/**
 * packages/core/src/graph.ts
 *
 * buildGraph: the single whole-graph validation entry. Walks modules (identity
 * cycles, duplicate names, diamond dedupe), flattens entries with provenance,
 * resolves shadowing by locality, checks dependencies and ordering, and only
 * then composes Layers. snapshot() turns the result into a JSON-safe DTO.
 */

import { Layer } from 'effect'
import { walkModules } from './cycle'
import { AmbiguousProvider, DependencyCycle, MissingDependency } from './errors'
import { isDeclaredLayer, isModule, isServiceDefinition, type Entry, type Module } from './module'
import type { Lifetime } from './service'

type AnyLayer = Layer.Layer<any, any, any>

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
  readonly layer: AnyLayer
}

export interface Shadowing {
  readonly tag: string
  readonly winner: string
  readonly shadowed: readonly string[]
}

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

const where = (n: GraphNode) => (n.module ? `module "${n.module.name}"` : 'root entries')

export function buildGraph(input: readonly (Module | Entry)[]): Graph {
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
    const base = { module, depth, paths }
    const isPrivate = (provides: readonly string[]) =>
      module !== undefined && !provides.some((k) => module.exports.some((t) => t.key === k))
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
        opaque: false, private: isPrivate(provides), layer: entry.layer,
      }
    }
    return {
      ...base, id: `opaque:${module?.name ?? 'root'}#${opaqueN++}`, provides: [], requires: [],
      lifetime: module?.lifetime ?? 'app', opaque: true, private: module !== undefined, layer: entry as AnyLayer,
    }
  })

  // 3. Shadowing by locality; same Tag at the same (best) depth -> ambiguous.
  const byTag = new Map<string, GraphNode[]>()
  for (const n of all) for (const k of n.provides) byTag.set(k, [...(byTag.get(k) ?? []), n])
  const winners = new Map<string, GraphNode>()
  const lost: [tag: string, winner: GraphNode, losers: GraphNode[]][] = []
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
    winners.set(tag, top[0]!)
    if (ns.length > 1) lost.push([tag, top[0]!, ns.filter((n) => n !== top[0])])
  }
  // A multi-Tag declared Layer is atomic: winning some Tags while losing others would let its
  // losing outputs re-enter the context, so that split is rejected.
  for (const n of all) {
    const won = n.provides.filter((k) => winners.get(k) === n)
    if (won.length > 0 && won.length < n.provides.length) {
      const lostTag = n.provides.find((k) => winners.get(k) !== n)!
      const other = winners.get(lostTag)!
      throw new AmbiguousProvider({
        tag: lostTag, modules: [other.module?.name ?? '(root)', n.module?.name ?? '(root)'],
        message:
          `Declared Layer "${n.id}" (${where(n)}) is only partially shadowed: "${lostTag}" is provided more ` +
          `locally by ${where(other)}. Shadow every Tag it provides, or split the Layer.`,
      })
    }
  }
  const live = all.filter((n) => !n.opaque && n.provides.some((k) => winners.get(k) === n))
  // Shadowed nodes share their Tag key with the winner; suffix the owning module to keep ids unique.
  const shadowedId = new Map(
    all.filter((n) => !n.opaque && !live.includes(n)).map((n) => [n, `${n.id}@${n.module?.name ?? '(root)'}`]),
  )
  const shadowed = [...shadowedId].map(([n, id]) => ({ ...n, id }))
  const idOf = (n: GraphNode) => shadowedId.get(n) ?? n.id
  const shadowing: Shadowing[] = lost.map(([tag, w, ls]) => ({ tag, winner: idOf(w), shadowed: ls.map(idOf) }))

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
    }
  }
  const ordered = toposort(live, (k) => winners.get(k)!)

  // 5. Compose: bare Layers first as a base, then nodes in order. No construction happens here.
  const opaque = all.filter((n) => n.opaque)
  let acc: AnyLayer = opaque.length ? Layer.mergeAll(...(opaque.map((n) => n.layer) as [AnyLayer])) : (Layer.empty as unknown as AnyLayer)
  for (const n of ordered) acc = n.layer.pipe(Layer.provideMerge(acc))
  const edges = ordered.flatMap((n) => n.requires.map((tag) => ({ from: n.id, to: winners.get(tag)!.id, tag })))
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

export function snapshot(graph: Graph): GraphSnapshot {
  const dto = (n: GraphNode, shadowed: boolean) => ({
    id: n.id,
    name: n.opaque ? n.id : n.provides.join('+'),
    provides: [...n.provides],
    lifetime: n.lifetime,
    module: n.module ? { id: n.module.name, name: n.module.name } : null,
    paths: n.paths.map((p) => [...p]),
    private: n.private,
    opaque: n.opaque,
    shadowed,
  })
  return {
    nodes: [
      ...graph.opaque.map((n) => dto(n, false)),
      ...graph.nodes.map((n) => dto(n, false)),
      ...graph.shadowed.map((n) => dto(n, true)),
    ],
    edges: graph.edges.map((e) => ({ ...e })),
    shadowing: graph.shadowing.map((s) => ({ ...s, shadowed: [...s.shadowed] })),
  }
}
