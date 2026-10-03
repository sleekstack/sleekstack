import { type Atom, type AtomStore, MissingDependency } from '@sleekstack/core'
import { Context, Effect, ExecutionStrategy, Exit, Option, Scope } from 'effect'
import type { Node } from './node'

/** The mount's atom store. `mount` and `renderToString` provide it. */
export class Store extends Effect.Tag('Store')<Store, AtomStore>() {}

/** Atoms read by the component instance that is running; `undefined` outside a wrapped instance. */
export class Collector extends Context.Reference<Collector>()('@sleekstack/ui/Collector', {
  defaultValue: (): Map<Atom.Atom<any>, unknown> | undefined => undefined,
}) {}

/** Enclosing `Boundary` handlers, innermost last; captured with an instance's context for its re-runs. */
export class Handlers extends Context.Reference<Handlers>()('@sleekstack/ui/Handlers', {
  defaultValue: (): ReadonlyArray<{ readonly tag: string; readonly fallback: (error: any) => Effect.Effect<Node, any, any> }> => [],
}) {}

/**
 * Lifetime of `Provider` layers. When set (by `mount`), each component run gets a child scope and its layers are
 * built there, so services captured for a re-run stay alive; a run's scope closes when the next run of the same
 * instance succeeds, when that run fails, or with its parent. Unset, a `Provider` layer lives only for the render.
 */
export class RenderScope extends Context.Reference<RenderScope>()('@sleekstack/ui/RenderScope', {
  defaultValue: (): Scope.Scope | undefined => undefined,
}) {}

/** Identity of the running component instance, the same object across its re-runs; `undefined` outside one. */
export class Instance extends Context.Reference<Instance>()('@sleekstack/ui/Instance', {
  defaultValue: (): object | undefined => undefined,
}) {}

// Typed `never` in E: `Store` is a requirement, so a missing store is unreachable for checked code; at runtime it fails with a tagged error.
const store = (hook: string): Effect.Effect<AtomStore, never, Store> =>
  Effect.flatMap(Effect.serviceOption(Store), (s) =>
    Option.isSome(s) ? Effect.succeed(s.value) : (Effect.fail(new MissingDependency({ tag: 'Store', service: hook, missing: 'Store', message: `"${hook}" requires "Store", which is not provided` })) as unknown as Effect.Effect<never>),
  )

/** Reads an atom and registers it as a dependency of the running component instance. */
export const useAtomValue = <A>(atom: Atom.Atom<A>): Effect.Effect<A, never, Store> =>
  Effect.flatMap(store('useAtomValue'), (s) =>
    Effect.flatMap(Collector, (c) =>
      Effect.flatMap(RenderScope, (scope) => {
        const first = c !== undefined && !c.has(atom)
        // Hold the atom for the run's lifetime so it is not dropped (and reset) before the renderer subscribes.
        const hold = first && scope ? Effect.flatMap(Effect.sync(() => s.retain(atom)), (release) => Scope.addFinalizer(scope, Effect.sync(release))) : Effect.void
        return Effect.map(hold, () => {
          const value = s.get(atom)
          if (first) c.set(atom, value)
          return value
        })
      }),
    ),
  )

/** Returns a setter for `atom`; registers nothing. */
export const useSetAtom = <R, W>(atom: Atom.Writable<R, W>): Effect.Effect<(value: W) => void, never, Store> =>
  Effect.map(store('useSetAtom'), (s) => (value: W) => s.set(atom, value))

/** `[value, set]`, like `useState`. */
export const useAtom = <R, W>(atom: Atom.Writable<R, W>): Effect.Effect<readonly [R, (value: W) => void], never, Store> =>
  Effect.zip(useAtomValue(atom), useSetAtom(atom))

/** Run scopes of components that read no atoms, keyed by a fresh wrapper around their output; the renderer owns them. */
export const runScopes = new WeakMap<Node, Scope.CloseableScope>()

/** Fresh wrappers around what a re-run produced from a `Boundary` fallback rather than from the component itself. */
export const fallbacks = new WeakSet<Node>()
const asFallback = (n: Node): Node => {
  const wrapped: Node = { _tag: 'Fragment', children: [n] }
  fallbacks.add(wrapped)
  return wrapped
}

const owned = (child: Node, scope: Scope.CloseableScope): Node => {
  const wrapped: Node = { _tag: 'Fragment', children: [child] }
  runScopes.set(wrapped, scope)
  return wrapped
}

// Runs a fallback in its own child of `RenderScope`, owned by the renderer like an untracked run.
const scopedRun = (run: Effect.Effect<Node, any, any>): Effect.Effect<Node, any, any> =>
  Effect.flatMap(RenderScope, (parent) =>
    parent
      ? Effect.flatMap(Scope.fork(parent, ExecutionStrategy.sequential), (own) =>
          Effect.onExit(Effect.map(Effect.provideService(run, RenderScope, own), (n) => owned(n, own)), (exit) => (Exit.isSuccess(exit) ? Effect.void : Scope.close(own, exit))),
        )
      : run,
  )

type Handler = Context.Tag.Service<Handlers>[number]

// A re-run is outside any `Catch` frame: apply the innermost captured handler whose tag matches; a failing fallback goes to the handlers outside it.
const withHandlers = (run: Effect.Effect<Node, any, any>, hs: ReadonlyArray<Handler>): Effect.Effect<Node, any, any> =>
  Effect.catchIf(
    run,
    (e: any) => typeof e?._tag === 'string',
    (e: any) => {
      let i = hs.length - 1
      while (i >= 0 && hs[i]!.tag !== e._tag) i--
      return i < 0 ? Effect.fail(e) : Effect.map(withHandlers(scopedRun(Effect.provideService(hs[i]!.fallback(e), Handlers, hs.slice(0, i))), hs.slice(0, i)), asFallback)
    },
  )
const handled = (run: Effect.Effect<Node, any, any>): Effect.Effect<Node, any, any> => Effect.flatMap(Handlers, (hs) => withHandlers(run, hs))


/**
 * Runs a component as one instance: fresh collector, own scope, captured context; returns a `Reactive` node when it read atoms.
 * Under a `RenderScope` the node carries its run's scope: a failed run closes it, otherwise its owner (the DOM renderer) does.
 */
export const instance = <P>(type: (props: P) => Effect.Effect<Node, any, any>, props: P): Effect.Effect<Node, any, any> => {
  const id = {}
  const run: Effect.Effect<Node, any, any> = Effect.flatMap(Effect.context<never>(), (ctx) => {
    const body = (own: Scope.CloseableScope | undefined): Effect.Effect<Node, any, any> => {
      const reads = new Map<Atom.Atom<any>, unknown>()
      const scoped = own ? Effect.provideService(type(props), RenderScope, own) : type(props)
      return Effect.map(Effect.provideService(Effect.provideService(scoped, Collector, reads), Instance, id), (child): Node =>
        reads.size === 0
          ? own
            ? owned(child, own)
            : child
          : { _tag: 'Reactive', atoms: [...reads.keys()], seen: [...reads.values()], child, scope: own, rerun: Effect.provide(handled(run), ctx) as Effect.Effect<Node> },
      )
    }
    return Effect.flatMap(RenderScope, (parent) =>
      parent
        ? Effect.flatMap(Scope.fork(parent, ExecutionStrategy.sequential), (own) =>
            Effect.onExit(body(own), (exit) => (Exit.isSuccess(exit) ? Effect.void : Scope.close(own, exit))),
          )
        : body(undefined),
    )
  })
  return run
}
