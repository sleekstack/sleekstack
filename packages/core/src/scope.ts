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
import { AmbiguousProvider, MissingDependency, missingDependency, type PrivateDependency } from './errors'
import { isPrivateTag, privateDependency, resolveEntries, toposort, type Graph } from './graph'
import type { Entry, Module } from './module'
import { lazy, Resolver, type Resolve } from './lazy'
import type { Lifetime } from './service'

type AnyLayer = Layer.Layer<any, any, any>
type Local = {
  readonly id: string
  readonly provides: readonly string[]
  readonly requires: readonly string[]
  readonly layer: AnyLayer
  readonly module?: Module | undefined
}
/** Private Tag key -> owning module. */
type PrivateMap = ReadonlyMap<string, Module>

/**
 * Carried in every exposed `ChildScope.context`: the private Tags hidden from it, so a consumer
 * whose lookup misses can report PrivateDependency instead of "not provided".
 */
export const Privacy = Context.GenericTag<PrivateMap>('@sleekstack/core/Privacy')

/**
 * The PrivateDependency for looking up `key` from outside its module in `context`, or undefined when `key` is not private there.
 *
 * @param context - A scope's public `context`.
 * @param key - The Tag key that was looked up.
 * @param requiredBy - Who looked it up, for the error message.
 * @returns A `PrivateDependency` error to throw or fail with, or `undefined`.
 *
 * @example
 * ```ts
 * import { Context } from 'effect'
 * import { privateDependencyOf } from '@sleekstack/core'
 *
 * const error = privateDependencyOf(Context.empty(), 'Db', 'UserService') // undefined: nothing is private
 * ```
 */
export const privateDependencyOf = (context: Context.Context<any>, key: string, requiredBy: string) => {
  const owner = Context.getOption(context, Privacy)
  const module = owner._tag === 'Some' ? owner.value.get(key) : undefined
  return module && privateDependency(key, module, requiredBy)
}

const tagName = (tag: Context.Tag<any, any>): string => (tag as { key?: string }).key ?? String(tag)

/** @internal The typed miss for `key` in `context`: PrivateDependency when it is private there, else MissingDependency. */
export const resolutionFailure = (context: Context.Context<any>, key: string, requiredBy: string): MissingDependency | PrivateDependency =>
  privateDependencyOf(context, key, requiredBy) ?? missingDependency(key, requiredBy)

// The one Tag lookup: the instance, or the typed miss.
const lookupTag = <T>(context: Context.Context<any>, tag: Context.Tag<any, T>, requiredBy: string) => {
  const found = Context.getOption(context, tag)
  if (found._tag === 'Some') return { ok: true as const, value: found.value }
  return { ok: false as const, error: resolutionFailure(context, tagName(tag), requiredBy) }
}

/**
 * Looks `tag` up in a scope's public `context`.
 *
 * @param context - A scope's public `context`.
 * @param tag - The Tag to resolve.
 * @param requiredBy - Who looked it up, for the error message.
 * @returns The service instance.
 * @throws `PrivateDependency` when the Tag is private to a module; `MissingDependency` when it is not provided.
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
 * @throws Fails with `PrivateDependency` when the Tag is private to a module; `MissingDependency` when it is not provided.
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
export const resolveTagEffect = <T>(tag: Context.Tag<any, T>, requiredBy: string): Effect.Effect<T, MissingDependency | PrivateDependency> =>
  Effect.flatMap(Effect.context<never>(), (context) => {
    const r = lookupTag(context as Context.Context<any>, tag, requiredBy)
    return r.ok ? Effect.succeed(r.value) : Effect.fail(r.error)
  })

/** Options for {@link makeAppScope}. */
export interface ScopeOptions {
  /** Sink for finalizer failures of closes nobody awaits (`dispose`). Default `console.error`. */
  readonly onFinalizerError?: (cause: Cause.Cause<unknown>) => void
}

/** A built scope (app, request, or component): its public context, child scopes, and finalization. */
export interface ChildScope {
  readonly lifetime: Lifetime
  readonly context: Context.Context<any>
  /**
   * Opens a nested scope. `entries` are child-boundary entries (modules resolved like buildGraph's:
   * imports, thunks, per-Tag locality): built in the new scope with their lifetime coerced to it,
   * shadowing parent instances inside that scope only.
   */
  readonly child: (lifetime: 'request' | 'component', entries?: readonly (Entry | Module)[]) => Effect.Effect<ChildScope, unknown>
  /** @internal Full context (private Tags included), the parent of nested scopes. */
  readonly inner: Context.Context<any>
  /** @internal Private Tags hidden from `context`. */
  readonly privates: PrivateMap
  /** @internal The Effect Scope holding this scope's services; closed by `close`. */
  readonly scope: Scope.CloseableScope
  /** Runs finalizers in reverse acquisition order; the Exit aggregates every failure. */
  readonly close: Effect.Effect<Exit.Exit<void, unknown>>
  /** Un-awaited close: failures go to `onFinalizerError`. */
  readonly dispose: () => void
}

/** The root scope returned by {@link makeAppScope}. */
export type AppScope = ChildScope

type Node = Local & { readonly requires: readonly string[] }

/**
 * Builds every node over `parent` through the lazy state machine: declared requires first, generator
 * layers' `yield*`s on demand (via {@link Resolver}). Each node builds in its own scope, attached to
 * `scope` only once it succeeds, so finalizers run once, in reverse build order.
 */
const buildAll = (
  scope: Scope.Scope,
  memo: Layer.MemoMap,
  parent: Context.Context<any>,
  privates: PrivateMap,
  node: ReadonlyMap<string, Node>,
  ordered: readonly Node[],
) => {
  let ctx = parent
  const get: (n: Node, chain?: readonly Node[]) => Effect.Effect<void, unknown> = lazy<Node, void>((n) => n.id, (n, chain) =>
    Effect.gen(function* () {
      for (const r of n.requires) yield* get(node.get(r)!, chain)
      const resolve: Resolve = (tag) => {
        const key = tagName(tag)
        const owner = privates.get(key)
        if (owner && owner !== n.module) return Effect.fail(privateDependency(key, owner, n.id))
        const local = node.get(key)
        if (local) return Effect.map(get(local, chain), () => Context.unsafeGet(ctx, tag))
        const found = Context.getOption(parent, tag)
        return found._tag === 'Some' ? Effect.succeed(found.value) : Effect.fail(missingDependency(key, n.id))
      }
      const own = yield* Scope.make()
      const out = yield* Effect.exit(Layer.buildWithMemoMap(n.layer, memo, own).pipe(Effect.provide(Context.add(ctx, Resolver, resolve))))
      if (Exit.isFailure(out)) {
        yield* Scope.close(own, out)
        return yield* Effect.failCause(out.cause)
      }
      yield* Scope.addFinalizerExit(scope, (exit) => Scope.close(own, exit))
      ctx = Context.merge(ctx, out.value)
    }))
  // Opaque (provides nothing) first, then nodes in order.
  const all = [...ordered.filter((n) => n.provides.length === 0), ...ordered.filter((n) => n.provides.length > 0)]
  return Effect.forEach(all, (n) => get(n), { discard: true }).pipe(Effect.map(() => ctx))
}

/** Builds `locals` over `parent` in a new scope with a fresh memo map; closes the scope on failure/interrupt. */
const open = (
  lifetime: Lifetime,
  graph: Graph,
  parent: Context.Context<any>,
  parentPrivates: PrivateMap,
  locals: readonly Local[],
  options: ScopeOptions,
): Effect.Effect<ChildScope, unknown> => {
  const byKey = new Map<string, Local>()
  for (const n of locals) {
    for (const k of n.provides) {
      const prev = byKey.get(k)
      if (prev) {
        throw new AmbiguousProvider({
          tag: k, modules: [prev.id, n.id],
          message: `Tag "${k}" is provided by several boundary entries of one ${lifetime} scope: "${prev.id}", "${n.id}"`,
        })
      }
      byKey.set(k, n)
    }
  }
  // Tags provided here shadow the parent's (a new public provider); this scope's private Tags join the rest.
  const privates = new Map([...parentPrivates].filter(([k]) => !byKey.has(k)))
  for (const [k, n] of byKey) if (n.module && isPrivateTag(n.module, k)) privates.set(k, n.module)
  for (const n of locals) {
    for (const r of n.requires) {
      const owner = privates.get(r)
      if (owner && owner !== n.module) throw privateDependency(r, owner, n.id)
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
  const sink = options.onFinalizerError ?? ((cause) => console.error(Cause.pretty(cause)))

  return Effect.uninterruptibleMask((restore) =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const memo = yield* Layer.makeMemoMap
      const built = yield* Effect.exit(restore(buildAll(scope, memo, parent, privates, node, ordered)))
      if (Exit.isFailure(built)) {
        yield* Scope.close(scope, built)
        return yield* Effect.failCause(built.cause)
      }
      const inner = built.value
      const context = Context.add(
        Context.unsafeMake(new Map([...inner.unsafeMap].filter(([k]) => !privates.has(k)))),
        Privacy, privates,
      )
      const close = Effect.exit(Scope.close(scope, Exit.void))
      const self: ChildScope = {
        lifetime,
        context,
        inner,
        privates,
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
            const { live, opaque } = resolveEntries(entries)
            const extras = [...opaque, ...live]
            const shadowed = new Set(extras.flatMap((e) => e.provides))
            // Every child scope owns fresh instances of its lifetime's nodes, even when nested in a same-lifetime parent.
            const fromGraph = [...graph.opaque, ...graph.nodes].filter(
              (n) => n.lifetime === childLifetime && !n.provides.some((k) => shadowed.has(k)),
            )
            return open(childLifetime, graph, inner, privates, [...fromGraph, ...extras], options)
          }),
      }
      return self
    }),
  ) as Effect.Effect<ChildScope, unknown>
}

/**
 * Opens the app scope: builds every app-lifetime node (and app-lifetime bare Layers) once.
 *
 * @param graph - A graph from `buildGraph`.
 * @param options - Finalizer-error sink for `dispose`.
 * @returns An Effect yielding the app scope; it fails with whatever a service's acquisition fails with.
 * @throws {@link MissingDependency} `MissingDependency`, {@link PrivateDependency} `PrivateDependency`, or {@link AmbiguousProvider} `AmbiguousProvider` (as defects) when child-scope entries do not resolve.
 *
 * @example
 * ```ts
 * import { Effect } from 'effect'
 * import { buildGraph, makeAppScope } from '@sleekstack/core'
 *
 * const program = Effect.gen(function* () {
 *   const app = yield* makeAppScope(buildGraph([]))
 *   const request = yield* app.child('request')
 *   yield* request.close
 *   yield* app.close
 * })
 * ```
 */
export const makeAppScope = (graph: Graph, options: ScopeOptions = {}): Effect.Effect<AppScope, unknown> =>
  Effect.suspend(() =>
    open('app', graph, Context.empty() as Context.Context<any>, new Map(), [...graph.opaque, ...graph.nodes].filter((n) => n.lifetime === 'app'), options),
  )
