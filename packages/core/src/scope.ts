/**
 * packages/core/src/scope.ts
 *
 * Scope runtime (R6). One scope instance per lifetime instance. The app scope
 * builds app-lifetime entries once, in position order; a child scope (request /
 * component) builds its lifetime's entries with a fresh memo map on top of the parent
 * context, so parent services are never rebuilt. Closing runs finalizers in reverse
 * acquisition order and returns an Exit aggregating every finalizer failure.
 */

import { Cause, Context, Effect, Exit, Layer, Scope } from 'effect'
import { MissingDependency, missingDependency } from './errors'
import { flatten, type PlanNode } from './graph'
import type { Entry, Module } from './module'
import { Resolver, type Resolve } from './lazy'
import type { Lifetime } from './lifetime'

const tagName = (tag: Context.Tag<any, any>): string => (tag as { key?: string }).key ?? String(tag)

/** @internal The typed miss for `key`: `requiredBy` looked it up and nothing provides it. */
export const resolutionFailure = (key: string, requiredBy: string): MissingDependency => missingDependency(key, requiredBy)

// The one Tag lookup: the instance, or the typed miss.
const lookupTag = <T>(context: Context.Context<any>, tag: Context.Tag<any, T>, requiredBy: string) => {
  const found = Context.getOption(context, tag)
  if (found._tag === 'Some') return { ok: true as const, value: found.value }
  return { ok: false as const, error: resolutionFailure(tagName(tag), requiredBy) }
}

// Effect 3.21 `Context.unsafeGet`: `Error("Service not found: <key>")` (no `: <key>` for an empty key), plus
// ` (defined at <site>)` when the Tag recorded its creation site. Pinned by atom-scope.test.ts.
const NOT_FOUND = /^Service not found(?:: (.*?))?(?: \(defined at .*\))?$/s

/** @internal The Tag key of an Effect "Service not found" defect, or undefined for any other defect. */
export const notFoundKey = (defect: unknown): string | undefined => {
  if (!(defect instanceof Error)) return undefined
  const m = NOT_FOUND.exec(defect.message)
  return m ? (m[1] ?? '') : undefined
}

/**
 * Looks `tag` up in a scope's public `context`.
 *
 * @param context - A scope's public `context`.
 * @param tag - The Tag to resolve.
 * @param requiredBy - Who looked it up, for the error message.
 * @returns The service instance.
 * @throws `MissingDependency` when it is not provided.
 *
 * @example
 * ```ts
 * import { Context } from 'effect'
 * import { resolveTag } from '@sleekstack/core'
 *
 * class Clock extends Context.Tag('Clock')<Clock, number>() {}
 * resolveTag(Context.make(Clock, 1), Clock, 'example') // 1
 * ```
 */
export const resolveTag = <T>(context: Context.Context<any>, tag: Context.Tag<any, T>, requiredBy: string): T => {
  const r = lookupTag(context, tag, requiredBy)
  if (r.ok) return r.value
  throw r.error
}

/**
 * {@link resolveTag} as an Effect over the running context: fails with a typed miss instead of throwing.
 *
 * @param tag - The Tag to resolve.
 * @param requiredBy - Who looked it up, for the error.
 * @returns An Effect of the service instance.
 * @throws Fails with `MissingDependency` when it is not provided.
 *
 * @example
 * ```ts
 * import { Context, Effect } from 'effect'
 * import { resolveTagEffect } from '@sleekstack/core'
 *
 * class Clock extends Context.Tag('Clock')<Clock, number>() {}
 * Effect.runSync(Effect.provideService(resolveTagEffect(Clock, 'example'), Clock, 1)) // 1
 * ```
 */
export const resolveTagEffect = <T>(tag: Context.Tag<any, T>, requiredBy: string): Effect.Effect<T, MissingDependency> =>
  Effect.flatMap(Effect.context<never>(), (context) => {
    const r = lookupTag(context as Context.Context<any>, tag, requiredBy)
    return r.ok ? Effect.succeed(r.value) : Effect.fail(r.error)
  })

/** Options for {@link makeAppScope}. */
export interface ScopeOptions {
  /** Sink for finalizer failures of closes nobody awaits (`dispose`). Default `console.error`. */
  readonly onFinalizerError?: (cause: Cause.Cause<unknown>) => void
}

/** A built scope (app, request, or component): its context, child scopes, and finalization. */
export interface ChildScope {
  readonly lifetime: Lifetime
  readonly context: Context.Context<any>
  /**
   * Opens a nested scope. `entries` are child-boundary entries (modules flattened like the root's), built in the new
   * scope after its lifetime's entries, so they shadow parent instances inside that scope only.
   */
  readonly child: (lifetime: 'request' | 'component', entries?: readonly (Entry | Module)[]) => Effect.Effect<ChildScope, unknown>
  /** @internal The Effect Scope holding this scope's services; closed by `close`. */
  readonly scope: Scope.CloseableScope
  /** Runs finalizers in reverse acquisition order; the Exit aggregates every failure. */
  readonly close: Effect.Effect<Exit.Exit<void, unknown>>
  /** Un-awaited close: failures go to `onFinalizerError`. */
  readonly dispose: () => void
}

/** The root scope returned by {@link makeAppScope}. */
export type AppScope = ChildScope

/**
 * Builds every node in order over `parent`: each Layer sees what was built before it (plus {@link Resolver}) and its
 * output is merged on top, so a later Layer wins. A Layer that needs a Tag not built yet fails with MissingDependency.
 * The first `overrides` nodes (child-boundary entries) lock the Tags they provide, so dependents built after them see the override.
 * Each node builds in its own scope, attached to `scope` only once it succeeds, so finalizers run once, in reverse build order.
 */
const buildAll = (scope: Scope.Scope, memo: Layer.MemoMap, parent: Context.Context<any>, nodes: readonly PlanNode[], overrides: number) => {
  let ctx = parent
  const locked = new Set<string>() // Tags the first `overrides` nodes built: later nodes still build but cannot replace them
  const step = (n: PlanNode, i: number) => {
    const label = n.module?.name ?? 'root'
    const resolve: Resolve = (tag) => {
      const found = Context.getOption(ctx, tag)
      return found._tag === 'Some' ? Effect.succeed(found.value) : Effect.fail(missingDependency(tagName(tag), label))
    }
    // Build -> attach is uninterruptible (only the build itself is), so a built node's scope never leaks.
    return Effect.uninterruptibleMask((restore) =>
      Effect.gen(function* () {
        const own = yield* Scope.make()
        const out = yield* Effect.exit(
          restore(
            Layer.buildWithMemoMap(n.layer, memo, own).pipe(
              Effect.provide(Context.add(ctx, Resolver, resolve)),
              Effect.catchAllDefect((d) => {
                const key = notFoundKey(d)
                return key === undefined ? Effect.die(d) : Effect.fail(missingDependency(key, label))
              }),
            ),
          ),
        )
        if (Exit.isFailure(out)) {
          yield* Scope.close(own, out)
          return yield* Effect.failCause(out.cause)
        }
        yield* Scope.addFinalizerExit(scope, (exit) => Scope.close(own, exit))
        const provided = out.value.unsafeMap
        if (i < overrides) for (const k of provided.keys()) locked.add(k)
        ctx = Context.merge(ctx, i < overrides ? out.value : Context.unsafeMake(new Map([...provided].filter(([k]) => !locked.has(k)))))
      }))
  }
  return Effect.forEach(nodes, step, { discard: true }).pipe(Effect.map(() => ctx))
}

/** Builds `nodes` over `parent` in a new scope with a fresh memo map; closes the scope on failure/interrupt. */
const open = (
  lifetime: Lifetime,
  graph: readonly PlanNode[],
  parent: Context.Context<any>,
  nodes: readonly PlanNode[],
  overrides: number,
  options: ScopeOptions,
): Effect.Effect<ChildScope, unknown> => {
  const sink = options.onFinalizerError ?? ((cause) => console.error(Cause.pretty(cause)))

  return Effect.uninterruptibleMask((restore) =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const memo = yield* Layer.makeMemoMap
      const built = yield* Effect.exit(restore(buildAll(scope, memo, parent, nodes, overrides)))
      if (Exit.isFailure(built)) {
        yield* Scope.close(scope, built)
        return yield* Effect.failCause(built.cause)
      }
      const context = built.value
      const close = Effect.exit(Scope.close(scope, Exit.void))
      const self: ChildScope = {
        lifetime,
        context,
        scope,
        close,
        dispose: () =>
          void Effect.runPromise(close).then((exit) => {
            if (Exit.isFailure(exit)) sink(exit.cause)
          }),
        child: (childLifetime, entries = []) =>
          Effect.suspend(() => {
            if (lifetime !== 'app' && lifetime !== childLifetime) {
              throw new Error(`A ${childLifetime} scope cannot be opened inside a ${lifetime} scope`)
            }
            // Every child scope owns fresh instances of its lifetime's nodes, even when nested in a same-lifetime parent.
            // Boundary entries build first and lock their Tags, so this lifetime's nodes depend on the override.
            // ponytail: a node the boundary entries shadow still builds (no provides metadata to skip it); skip it if that cost shows up.
            const extras = flatten(entries)
            const fromGraph = graph.filter((n) => n.lifetime === childLifetime)
            return open(childLifetime, graph, context, [...extras, ...fromGraph], extras.length, options)
          }),
      }
      return self
    }),
  ) as Effect.Effect<ChildScope, unknown>
}

/**
 * Opens the app scope: builds every app-lifetime entry once, in position order (deepest import first, root entries last).
 *
 * @param input - Root modules and/or entries. Not validated (that is `sleekstack check`'s job); a Layer that needs a Tag
 *   no earlier entry provided fails the build with `MissingDependency`.
 * @param options - Finalizer-error sink for `dispose`.
 * @returns An Effect yielding the app scope; it fails with whatever a service's acquisition fails with.
 *
 * @example
 * ```ts
 * import { Effect } from 'effect'
 * import { makeAppScope } from '@sleekstack/core'
 *
 * const program = Effect.gen(function* () {
 *   const app = yield* makeAppScope([])
 *   const request = yield* app.child('request')
 *   yield* request.close
 *   yield* app.close
 * })
 * ```
 */
export const makeAppScope = (input: readonly (Module | Entry)[], options: ScopeOptions = {}): Effect.Effect<AppScope, unknown> =>
  Effect.suspend(() => {
    const graph = flatten(input)
    return open('app', graph, Context.empty() as Context.Context<any>, graph.filter((n) => n.lifetime === 'app'), 0, options)
  })
