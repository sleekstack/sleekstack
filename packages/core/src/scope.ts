/**
 * packages/core/src/scope.ts
 *
 * Scope runtime (R6). One scope instance per lifetime instance. The app scope
 * builds app-lifetime nodes once; a child scope (request / component) builds
 * its lifetime's nodes with a fresh memo map on top of the parent context, so
 * parent services are never rebuilt. Closing runs finalizers in reverse
 * acquisition order and returns an Exit aggregating every finalizer failure.
 */

import { Cause, Context, Effect, Exit, Layer, Scope } from 'effect'
import { MissingDependency } from './errors'
import { toposort, type Graph } from './graph'
import { isDeclaredLayer, isServiceDefinition, type Entry } from './module'
import type { Lifetime } from './service'

type AnyLayer = Layer.Layer<any, any, any>
type Local = { readonly id: string; readonly provides: readonly string[]; readonly requires: readonly string[]; readonly layer: AnyLayer }

export interface ScopeOptions {
  /** Sink for finalizer failures of closes nobody awaits (`dispose`). Default `console.error`. */
  readonly onFinalizerError?: (cause: Cause.Cause<unknown>) => void
}

export interface ChildScope {
  readonly lifetime: Lifetime
  readonly context: Context.Context<any>
  /**
   * Opens a nested scope. `entries` are child-boundary entries: built in the new scope with
   * their lifetime coerced to it, shadowing parent instances inside that scope only.
   */
  readonly child: (lifetime: 'request' | 'component', entries?: readonly Entry[]) => Effect.Effect<ChildScope, unknown>
  /** Runs finalizers in reverse acquisition order; the Exit aggregates every failure. */
  readonly close: Effect.Effect<Exit.Exit<void, unknown>>
  /** Un-awaited close: failures go to `onFinalizerError`. */
  readonly dispose: () => void
}

export type AppScope = ChildScope

const toLocal = (entry: Entry, i: number): Local => {
  if (isServiceDefinition(entry)) {
    return { id: entry.tag.key, provides: [entry.tag.key], requires: entry.requires.map((t) => t.key), layer: entry.layer }
  }
  if (isDeclaredLayer(entry)) {
    const provides = entry.provides.map((t) => t.key)
    return { id: provides.join('+'), provides, requires: entry.requires.map((t) => t.key), layer: entry.layer }
  }
  return { id: `opaque:boundary#${i}`, provides: [], requires: [], layer: entry as AnyLayer }
}

/** Builds `locals` over `parent` in a new scope with a fresh memo map; closes the scope on failure/interrupt. */
const open = (
  lifetime: Lifetime,
  graph: Graph,
  parent: Context.Context<any>,
  locals: readonly Local[],
  options: ScopeOptions,
): Effect.Effect<ChildScope, unknown> => {
  const byKey = new Map<string, Local>()
  for (const n of locals) for (const k of n.provides) byKey.set(k, n)
  for (const n of locals) {
    for (const r of n.requires) {
      if (!byKey.has(r) && !parent.unsafeMap.has(r)) {
        throw new MissingDependency({
          service: n.id, missing: r,
          message: `Service "${n.id}" (${lifetime} scope) requires "${r}", but neither this scope nor its parents provide it`,
        })
      }
    }
  }
  const nodes = locals.map((n) => ({ ...n, requires: n.requires.filter((r) => byKey.has(r)) }))
  const node = new Map(nodes.flatMap((n) => n.provides.map((k) => [k, n] as const)))
  const ordered = toposort(nodes, (k) => node.get(k)!)
  // Opaque (provides nothing) first, then nodes in order, over the parent context.
  let layer: AnyLayer = Layer.succeedContext(parent)
  for (const n of [...ordered.filter((n) => n.provides.length === 0), ...ordered.filter((n) => n.provides.length > 0)]) {
    layer = n.layer.pipe(Layer.provideMerge(layer))
  }
  const sink = options.onFinalizerError ?? ((cause) => console.error(Cause.pretty(cause)))

  return Effect.uninterruptibleMask((restore) =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const memo = yield* Layer.makeMemoMap
      const built = yield* Effect.exit(restore(Layer.buildWithMemoMap(layer, memo, scope)))
      if (Exit.isFailure(built)) {
        yield* Scope.close(scope, built)
        return yield* Effect.failCause(built.cause)
      }
      const context = built.value
      const close = Effect.exit(Scope.close(scope, Exit.void))
      const self: ChildScope = {
        lifetime,
        context,
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
            const extras = entries.map(toLocal)
            const shadowed = new Set(extras.flatMap((e) => e.provides))
            // Same-lifetime nesting: the graph's nodes already live in the parent; build only extras.
            const fromGraph =
              lifetime === childLifetime
                ? []
                : [...graph.opaque, ...graph.nodes].filter(
                    (n) => n.lifetime === childLifetime && !n.provides.some((k) => shadowed.has(k)),
                  )
            return open(childLifetime, graph, context, [...fromGraph, ...extras], options)
          }),
      }
      return self
    }),
  ) as Effect.Effect<ChildScope, unknown>
}

/** Opens the app scope: builds every app-lifetime node (and app-lifetime bare Layers) once. */
export const makeAppScope = (graph: Graph, options: ScopeOptions = {}): Effect.Effect<AppScope, unknown> =>
  Effect.suspend(() =>
    open('app', graph, Context.empty() as Context.Context<any>, [...graph.opaque, ...graph.nodes].filter((n) => n.lifetime === 'app'), options),
  )
