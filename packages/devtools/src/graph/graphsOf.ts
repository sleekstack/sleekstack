/**
 * packages/devtools/src/graph/graphsOf.ts
 *
 * Reads the root graphs out of whatever analyzer report the app supplied. Malformed input is skipped.
 */
export interface ReportGraph {
  readonly nodes: readonly { readonly id: string; readonly name: string; readonly lifetime: string }[]
  readonly edges: readonly { readonly from: string; readonly to: string; readonly tag: string }[]
}
/** Root kinds the panel names; any other value renders as a plain root (the schema is additive). */
export type RootKind = 'app' | 'request' | 'overrides' | 'opaque'
export interface RootGraph extends ReportGraph {
  readonly root: string
  readonly kind?: RootKind
}

const KINDS: readonly string[] = ['app', 'request', 'overrides', 'opaque']
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const strs = (v: unknown, keys: readonly string[]): boolean => isObj(v) && keys.every((k) => typeof v[k] === 'string')

const isGraph = (g: unknown): g is ReportGraph =>
  isObj(g) &&
  Array.isArray(g.nodes) &&
  g.nodes.every((n) => strs(n, ['id', 'name', 'lifetime'])) &&
  Array.isArray(g.edges) &&
  g.edges.every((e) => strs(e, ['from', 'to', 'tag']))

/**
 * The graphs in whatever the app supplied: an analyzer `Report` (`runtimes[].graph`), the
 * `sleekstack check --json` envelope (`roots[].graph`), else a bare `graphs[]`, each with its root `kind` when one is given, in report
 * order (app roots first). Anything malformed is skipped, never thrown on.
 */
export function graphsOf(report: unknown): readonly RootGraph[] {
  if (!isObj(report)) return []
  type Entry = { readonly graph: unknown; readonly kind?: unknown }
  const from = (list: unknown, pick: (r: unknown) => Entry): Entry[] => (Array.isArray(list) ? list.map(pick) : [])
  const rootOf = (r: unknown): Entry => (isObj(r) ? { graph: r.graph, kind: r.kind } : { graph: undefined })
  // Kind-carrying sources first (`runtimes`, then the CLI envelope's `roots`), bare `graphs` last: first source with a graph wins.
  const sources = [
    from(report.runtimes, rootOf),
    from(report.roots, rootOf),
    from(report.graphs, (g) => ({ graph: g })),
  ]
  const candidates = sources.find((c) => c.some((e) => isGraph(e.graph))) ?? []
  return candidates
    .filter((e) => isGraph(e.graph))
    .map(({ graph, kind }, i) => {
      const g = graph as ReportGraph & { root?: unknown }
      return {
        ...g,
        root: typeof g.root === 'string' ? g.root : `graph ${i + 1}`,
        ...(typeof kind === 'string' && KINDS.includes(kind) ? { kind: kind as RootKind } : {}),
      }
    })
}
