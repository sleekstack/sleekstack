/**
 * packages/analyze/src/model.ts
 *
 * The static graph model. `Graph` mirrors kit/core `snapshot()` (one node per provided Tag,
 * `Tag@Module` ids for shadowed providers) plus the module list and private Tags; built from
 * declarations read by `extract.ts`, never from executing app code.
 */

/** What made a root: `configureRuntime`, a runEffect `request` / `overrides` Layer, or a lenient opaque layer. */
export type RootKind = 'app' | 'request' | 'overrides' | 'opaque'

export type Lifetime = 'app' | 'request' | 'component'

export interface Location {
  /** Path relative to the tsconfig's directory. */
  readonly file: string
  /** 1-based. */
  readonly line: number
}

export interface AnalyzeError extends Location {
  readonly code: string
  readonly message: string
}

/** A `layer()` / kit `effect()` / `service()` / `declareLayer()` / bare Layer / plain-Layer leaf, as read from source. */
export interface ProviderDecl {
  readonly provides: readonly string[]
  readonly requires: readonly string[]
  readonly lifetime: Lifetime | undefined
  readonly opaque: boolean
  readonly loc: Location
}

/** A kit or core `module()` call, as read from source. */
export interface ModuleDecl {
  readonly name: string
  readonly entries: ProviderDecl[]
  readonly imports: ModuleDecl[]
  /** Undefined: every provided Tag is public. */
  exports: readonly string[] | undefined
  lifetime: Lifetime | undefined
  readonly loc: Location
}

export interface GraphNode {
  readonly id: string
  readonly name: string
  readonly provides: readonly string[]
  readonly lifetime: Lifetime
  readonly module: { readonly id: string; readonly name: string } | null
  readonly paths: readonly (readonly string[])[]
  readonly private: boolean
  readonly opaque: boolean
  readonly shadowed: boolean
}

export interface Edge {
  readonly from: string
  readonly to: string
  readonly tag: string
}

export interface Shadowing {
  readonly tag: string
  readonly winner: string
  readonly shadowed: readonly string[]
}

/** A kit `defineEffect` / `defineQuery` / `effect` / `query` call: the Tags its body `yield*`s, plus `opts.scope`. */
export interface ActionDecl {
  readonly yields: { readonly tag: string; readonly loc: Location }[]
  /** `opts.provide` as a synthetic module (its layers as entries, its modules as imports). */
  readonly provide: ModuleDecl
  readonly file: import('typescript').SourceFile
  readonly loc: Location
}

/** The graph reachable from one root module. */
export interface Graph {
  readonly root: string
  readonly nodes: readonly GraphNode[]
  readonly edges: readonly Edge[]
  readonly shadowing: readonly Shadowing[]
  readonly modules: readonly (Location & { readonly name: string; readonly imports: readonly string[]; readonly exports: readonly string[] | null })[]
  /** Ids of private Tag nodes. */
  readonly private: readonly string[]
}

/** Atoms live outside modules (resolved from the nearest LayerProvider); their deps arrays are edges. */
export interface Atoms {
  readonly nodes: readonly (Location & { readonly id: string })[]
  readonly edges: readonly Edge[]
}

export interface Report {
  /** One graph per root module (a module no other module imports). */
  readonly graphs: readonly Graph[]
  readonly atoms: Atoms
  readonly errors: readonly AnalyzeError[]
  /** Unreadable-declaration errors outside every module (emitted siblings, atoms, a bare module() call). */
  readonly extraction: readonly AnalyzeError[]
  /**
   * App roots first: one per `configureRuntime` call (`kind: 'app'`). Then one per Layer-valued branch of a
   * `runEffect({ request, overrides })` option (`'request'` / `'overrides'`, its graph overlaid on an app root),
   * or `'opaque'` when `lenient` downgraded its unresolvable layer.
   * Calls count outside test files, or only in `entries` when given. Each root is validated independently: its
   * errors are the unreadable declarations it reaches plus graph validation.
   */
  readonly runtimes: readonly (Location & { readonly kind: RootKind; readonly graph: Graph; readonly errors: readonly AnalyzeError[] })[]
}
