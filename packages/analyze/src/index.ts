/**
 * packages/analyze/src/index.ts
 *
 * `@sleekstack/analyze`: the static dependency-graph analyzer. `analyze({ project })` reads a
 * tsconfig project's core modules, plain Layers and runtime roots through the TypeScript checker and returns the graph
 * report; no app module is imported or executed.
 */

import { extract } from './extract'
import type { Report } from './model'

export type * from './model'
export { ERROR_CODES } from './errorCodes'

/**
 * Extracts the static graph of the tsconfig project at `project` (a tsconfig.json path). `entries` limits
 * `runtimes` to the `configureRuntime` / `runEffect` calls in those files (test files are then not skipped).
 * `lenient` turns an unresolvable runEffect layer into an opaque root instead of an error.
 */
export const analyze = (opts: {
  readonly project: string
  readonly entries?: readonly string[]
  readonly lenient?: boolean
}): Report => extract(opts.project, opts.entries, opts.lenient)

/** The `@sleekstack/ui` component pass: one tree per `mount` call and its MissingDependency / UnhandledError / EffectInsideReact / Unresolved errors. */
export { analyzeComponents } from './components'

/** The Server Service pass (ADR 0051): each `ServerService` contract with its raw method types, and its shape errors. */
export { analyzeServerServices } from './serverServices'
export type { ServerServiceDecl, ServerServiceMethod, ServerServiceReport } from './serverServices'
/** The server-only files (R12) and the test-file predicate, shared by `sleekstack check` and the Vite plugin. */
export { isServerOnly, SERVER_ONLY } from './serverServices'
export { TEST_FILE } from './extract'
/** The Controller pass (ADR 0053): routes, methods and their input Schemas, and the route derivation the plugin shares. */
export { analyzeControllers, controllerRoute } from './controllers'
export type {
  ControllerDecl,
  ControllerMethod,
  ControllerMethodName,
  ControllerReport,
  ControllerRoute,
} from './controllers'
export type { MethodSchema, PropertySchema, TaggedErrorSchema, TypeSchema } from './typeSchema'
