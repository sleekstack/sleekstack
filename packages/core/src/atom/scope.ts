/**
 * packages/core/src/atom/scope.ts
 *
 * Binds an AtomStore to a ChildScope: Effect atoms run on the scope's public context, Tag misses
 * become typed MissingDependency / PrivateDependency failures, and closing the scope disposes the store.
 */

import { Cause, Effect, Scope } from 'effect'
import { resolutionFailure, type ChildScope } from '../scope'
import { makeAtomStore, type AtomStore, type AtomStoreOptions } from './AtomStore'

// Effect 3.21 `Context.unsafeGet`: `Error("Service not found: <key>")` (no `: <key>` for an empty key), plus
// ` (defined at <site>)` when the Tag recorded its creation site. Pinned by atom-scope.test.ts.
const NOT_FOUND = /^Service not found(?:: (.*?))?(?: \(defined at .*\))?$/s

const notFoundKey = (defect: unknown): string | undefined => {
  if (!(defect instanceof Error)) return undefined
  const m = NOT_FOUND.exec(defect.message)
  return m ? (m[1] ?? '') : undefined
}

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
 * import { atomStoreFor, makeAppScope } from '@sleekstack/core'
 *
 * const app = Effect.runSync(makeAppScope([]))
 * const store = atomStoreFor(app)
 * ```
 */
export const atomStoreFor = (scope: ChildScope, options: Omit<AtomStoreOptions, 'context' | 'wrapBuild'> = {}): AtomStore => {
  const store = makeAtomStore({
    ...options,
    context: scope.context,
    wrapBuild: (effect, atom) => {
      const typed = (key: string) => resolutionFailure(scope.context, key, atom.label)
      // Die(Service not found) -> Fail(typed); every other node and the Cause's structure are kept.
      const mapCause = (cause: Cause.Cause<unknown>): Cause.Cause<unknown> =>
        Cause.match<Cause.Cause<unknown>, unknown>(cause, {
          onEmpty: Cause.empty,
          onFail: Cause.fail,
          onDie: (defect) => {
            const key = notFoundKey(defect)
            return key === undefined ? Cause.die(defect) : Cause.fail(typed(key))
          },
          onInterrupt: Cause.interrupt,
          onSequential: Cause.sequential,
          onParallel: Cause.parallel,
        })
      return Effect.catchAllCause(effect, (cause) => Effect.failCause(mapCause(cause)))
    },
  })
  Effect.runSync(Scope.addFinalizer(scope.scope, Effect.promise(() => store.dispose())))
  return store
}
