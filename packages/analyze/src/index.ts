/**
 * packages/analyze/src/index.ts
 *
 * `@sleekstack/analyze`: the static dependency-graph analyzer. `analyze({ project })` reads a
 * tsconfig project's kit/core declarations through the TypeScript checker and returns the graph
 * report; no app module is imported or executed.
 */

import { extract } from './extract'
import type { Report } from './model'

export type * from './model'

/**
 * Extracts the static graph of the tsconfig project at `project` (a tsconfig.json path). `entries` limits
 * `runtimes` to the `configureRuntime` / `runEffect` calls in those files (test files are then not skipped).
 * `lenient` turns an unresolvable runEffect layer into an opaque root instead of an error.
 */
export const analyze = (opts: { readonly project: string; readonly entries?: readonly string[]; readonly lenient?: boolean }): Report =>
  extract(opts.project, opts.entries, opts.lenient)
