/**
 * apps/showcase/src/errors/cases.server.ts
 *
 * The error gallery's 8 broken-graph cases (R3). Each case is an async
 * runner, awaited one at a time and isolated from the others: a fixture that
 * fails to build in one case can never take another case down with it. Every
 * case here uses its own throwaway Tags/modules — never the real domain graph
 * from ./domain — so a change to the domain graph can't accidentally break
 * (or silently fix) the gallery.
 *
 * Seven cases call `buildGraph` directly in a try/catch (a GraphError is a
 * synchronous throw). The eighth (raw-Layer) can't fail at `buildGraph`,
 * which only composes Layers without constructing them: it builds the
 * composed `graph.layer` in an isolated scope and reads the message off the
 * Cause (pattern: SPEC.md "Raw-Layer failure" decision context).
 */
import 'server-only'
import { buildGraph, module, service, type BareLayer } from '@sleekstack/core'
import { Cause, Context, Effect, Exit, Layer } from 'effect'

export interface CaseResult {
  readonly tag: string
  readonly message: string
}

export interface ErrorCase {
  readonly id: string
  readonly label: string
  /** The `_tag` this case must produce; anything else is shown as UNEXPECTED. */
  readonly expectedTag: string
  readonly run: () => Promise<CaseResult>
}

/** Runs a graph-building thunk, expecting it to throw a Data.TaggedError synchronously. */
async function runGraphCase(build: () => unknown): Promise<CaseResult> {
  try {
    build()
  } catch (e) {
    const err = e as { readonly _tag?: string; readonly message?: string }
    return { tag: err._tag ?? 'UNEXPECTED', message: err.message ?? String(e) }
  }
  return { tag: 'UNEXPECTED', message: 'expected the graph to fail to build, but it built successfully' }
}

const missingDependency: ErrorCase = {
  id: 'missing-dependency',
  label: 'MissingDependency',
  expectedTag: 'MissingDependency',
  run: () =>
    runGraphCase(() => {
      const Dep = Context.GenericTag<string>('errors.MissingDependency.dep')
      const Needs = Context.GenericTag<string>('errors.MissingDependency.needs')
      const NeedsDef = service(Needs, { requires: [Dep] }, ([dep]) => Effect.succeed(dep))
      buildGraph([NeedsDef])
    }),
}

const dependencyCycle: ErrorCase = {
  id: 'dependency-cycle',
  label: 'DependencyCycle',
  expectedTag: 'DependencyCycle',
  run: () =>
    runGraphCase(() => {
      const A = Context.GenericTag<string>('errors.DependencyCycle.a')
      const B = Context.GenericTag<string>('errors.DependencyCycle.b')
      const ADef = service(A, { requires: [B] }, ([b]) => Effect.succeed(b))
      const BDef = service(B, { requires: [A] }, ([a]) => Effect.succeed(a))
      buildGraph([ADef, BDef])
    }),
}

const captiveDependency: ErrorCase = {
  id: 'captive-dependency',
  label: 'CaptiveDependency',
  expectedTag: 'CaptiveDependency',
  run: () =>
    runGraphCase(() => {
      // request <-> component never nest (packages/core/src/lifetime.ts): a component-lifetime
      // service can't require a request-lifetime one — it would outlive its dependency.
      const Req = Context.GenericTag<string>('errors.CaptiveDependency.req')
      const Comp = Context.GenericTag<string>('errors.CaptiveDependency.comp')
      const ReqDef = service(Req, { lifetime: 'request' }, () => Effect.succeed('req'))
      const CompDef = service(Comp, { requires: [Req], lifetime: 'component' }, ([r]) => Effect.succeed(r))
      buildGraph([ReqDef, CompDef])
    }),
}

const ambiguousProvider: ErrorCase = {
  id: 'ambiguous-provider',
  label: 'AmbiguousProvider',
  expectedTag: 'AmbiguousProvider',
  run: () =>
    runGraphCase(() => {
      // Two entries at the SAME precedence (both direct/root, depth 0) — ambiguous, not
      // shadowing (shadowing needs different depths; see graph.ts resolveEntries step 3).
      const Config = Context.GenericTag<string>('errors.AmbiguousProvider.config')
      const A = service(Config, {}, () => Effect.succeed('a'))
      const B = service(Config, {}, () => Effect.succeed('b'))
      buildGraph([A, B])
    }),
}

const moduleCycle: ErrorCase = {
  id: 'module-cycle',
  label: 'ModuleCycle',
  expectedTag: 'ModuleCycle',
  run: () =>
    runGraphCase(() => {
      // Mutual thunk imports: an identity cycle, only reachable through forward references.
      const ModA = module({ name: 'errors.ModuleCycle.A', imports: () => [ModB] })
      const ModB = module({ name: 'errors.ModuleCycle.B', imports: () => [ModA] })
      buildGraph([ModA])
    }),
}

const duplicateModule: ErrorCase = {
  id: 'duplicate-module',
  label: 'DuplicateModule',
  expectedTag: 'DuplicateModule',
  run: () =>
    runGraphCase(() => {
      // Two distinct module objects sharing a name — not the same object, so it's not a diamond.
      const D1 = module({ name: 'errors.DuplicateModule.Shared' })
      const D2 = module({ name: 'errors.DuplicateModule.Shared' })
      const Root = module({ name: 'errors.DuplicateModule.Root', imports: [D1, D2] })
      buildGraph([Root])
    }),
}

const invalidModule: ErrorCase = {
  id: 'invalid-module',
  label: 'InvalidModule',
  expectedTag: 'InvalidModule',
  run: () =>
    runGraphCase(() => {
      const Bad = module({ name: 'errors.InvalidModule.Bad', imports: [{} as never] })
      buildGraph([Bad])
    }),
}

/**
 * The raw-Layer case: `buildGraph` only composes (no construction happens),
 * so a bare Layer that dies on build can't fail there — it fails once the
 * composed graph.layer is actually built, in its own scope.
 */
const rawLayerFailure: ErrorCase = {
  id: 'raw-layer-failure',
  label: 'Raw Layer failure',
  expectedTag: 'RawLayerFailure',
  run: async () => {
    const FailingModule = module({
      name: 'errors.RawLayerFailure.Boom',
      entries: [Layer.fail('boom') as unknown as BareLayer],
    })
    const graph = buildGraph([FailingModule])
    const exit = await Effect.runPromiseExit(Effect.scoped(Layer.build(graph.layer)))
    if (Exit.isSuccess(exit)) {
      return { tag: 'UNEXPECTED', message: 'expected the raw Layer to fail to build, but it built successfully' }
    }
    const defect = Cause.squash(exit.cause)
    const tag = (defect as { readonly _tag?: unknown })?._tag
    // Only the raw-Layer build error itself counts; any other tagged defect is a mismatch.
    return { tag: typeof tag === 'string' ? tag : 'RawLayerFailure', message: defect instanceof Error ? defect.message : String(defect) }
  },
}

export const errorCases: readonly ErrorCase[] = [
  missingDependency,
  dependencyCycle,
  captiveDependency,
  ambiguousProvider,
  moduleCycle,
  duplicateModule,
  invalidModule,
  rawLayerFailure,
]

/**
 * Runs one case in isolation and classifies it: a rejection, or a tag other
 * than the case's `expectedTag`, becomes `UNEXPECTED` (keeping what actually
 * happened in the message). Used by both the /errors page and the tests.
 */
export async function runCase(errorCase: ErrorCase): Promise<CaseResult> {
  let result: CaseResult
  try {
    result = await errorCase.run()
  } catch (e) {
    return { tag: 'UNEXPECTED', message: e instanceof Error ? e.message : String(e) }
  }
  if (result.tag === errorCase.expectedTag) return result
  return { tag: 'UNEXPECTED', message: `expected ${errorCase.expectedTag}, got ${result.tag}: ${result.message}` }
}
