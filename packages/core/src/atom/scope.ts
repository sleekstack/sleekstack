/**
 * packages/core/src/atom/scope.ts
 *
 * Binds an AtomStore to a ChildScope: Effect atoms run on the scope's public context, Tag misses
 * become typed MissingDependency / PrivateDependency failures, and closing the scope disposes the store.
 */

import { Effect, Option, Scope } from 'effect'
import { MissingDependency } from '../errors'
import { privateDependencyOf, type ChildScope } from '../scope'
import { makeAtomStore, type AtomStore, type AtomStoreOptions } from './AtomStore'

// Effect 3.21 `Context.unsafeGet`: `Error("Service not found: <key>")`, plus ` (defined at <site>)` when the
// Tag recorded its creation site. Pinned by atom-scope.test.ts.
const NOT_FOUND = /^Service not found: (.+?)(?: \(defined at .*\))?$/s

/**
 * Creates an {@link AtomStore} bound to `scope`. It is disposed (fibers interrupted) when the scope closes,
 * before the scope's service finalizers run.
 *
 * @param scope - The scope whose public `context` Effect atoms run with.
 * @param options - Store options other than `context`.
 * @returns The store.
 *
 * @example
 * ```ts
 * import { Effect } from 'effect'
 * import { atomStoreFor, buildGraph, makeAppScope } from '@sleekstack/core'
 *
 * const app = Effect.runSync(makeAppScope(buildGraph([])))
 * const store = atomStoreFor(app)
 * ```
 */
export const atomStoreFor = (scope: ChildScope, options: Omit<AtomStoreOptions, 'context' | 'wrapBuild'> = {}): AtomStore => {
  const store = makeAtomStore({
    ...options,
    context: scope.context,
    wrapBuild: (effect, atom) =>
      Effect.catchSomeDefect(effect, (defect) => {
        const key = defect instanceof Error ? NOT_FOUND.exec(defect.message)?.[1] : undefined
        if (key === undefined) return Option.none()
        return Option.some(Effect.fail(
          privateDependencyOf(scope.context, key, atom.label) ??
            new MissingDependency({
              service: atom.label, missing: key,
              message: `Atom "${atom.label}" requires "${key}", but no enclosing scope provides it`,
            }),
        ))
      }),
  })
  Effect.runSync(Scope.addFinalizer(scope.scope, Effect.promise(() => store.dispose())))
  return store
}
