/**
 * packages/core/src/lazy.ts
 *
 * Lazy memoized builds for one scope: each key is unbuilt, building (one shared in-flight
 * Deferred), or built. A failed build is not memoized: its marker is cleared so the next
 * `get` retries. Re-entering a key already on the resolving chain fails with DependencyCycle.
 */

import { Context, Deferred, Effect, Exit, FiberId } from 'effect'
import { DependencyCycle } from './errors'

type State<V> = { readonly built: false; readonly done: Deferred.Deferred<V, unknown> } | { readonly built: true; readonly value: V }

/** Resolves a Tag for the node being built: lazily builds its local provider, else reads the parent. */
export type Resolve = (tag: Context.Tag<any, any>) => Effect.Effect<unknown, unknown>

/** @internal Provided while a scope builds a node, so generator layers can resolve their `yield*`s lazily. */
export const Resolver = Context.GenericTag<Resolve>('@sleekstack/core/Resolver')

/**
 * @internal A memoized builder: `get(k, chain)` builds `k` at most once (concurrent callers share the build).
 * `chain` is the resolving path so far; `build` receives it extended with `k`.
 */
export const lazy = <K, V>(label: (k: K) => string, build: (k: K, chain: readonly K[]) => Effect.Effect<V, unknown>) => {
  const states = new Map<K, State<V>>()
  const get = (k: K, chain: readonly K[] = []): Effect.Effect<V, unknown> =>
    Effect.suspend(() => {
      if (chain.includes(k)) {
        const path = [...chain.slice(chain.indexOf(k)), k].map(label)
        return Effect.fail(new DependencyCycle({ path, message: `Dependency cycle: ${path.join(' -> ')}` }))
      }
      const s = states.get(k)
      if (s?.built) return Effect.succeed(s.value)
      if (s) return Deferred.await(s.done)
      const done = Deferred.unsafeMake<V, unknown>(FiberId.none)
      states.set(k, { built: false, done })
      return build(k, [...chain, k]).pipe(
        Effect.onExit((exit) => {
          if (Exit.isSuccess(exit)) states.set(k, { built: true, value: exit.value })
          else states.delete(k)
          return Deferred.done(done, exit)
        }),
      )
    })
  return get
}
