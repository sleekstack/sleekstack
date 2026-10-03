import { type Atom, type AtomStore, MissingDependency } from '@sleekstack/core'
import { Context, Effect, ExecutionStrategy, Exit, Option, Scope } from 'effect'
import type { Node } from './node'

/** The mount's atom store. `mount` and `renderToString` provide it. */
export class Store extends Effect.Tag('Store')<Store, AtomStore>() {}

/** Atoms read by the component instance that is running; `undefined` outside a wrapped instance. */
export class Collector extends Context.Reference<Collector>()('@sleekstack/ui/Collector', {
  defaultValue: (): Set<Atom.Atom<any>> | undefined => undefined,
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

// Typed `never` in E: `Store` is a requirement, so a missing store is unreachable for checked code; at runtime it fails with a tagged error.
const store = (hook: string): Effect.Effect<AtomStore, never, Store> =>
  Effect.flatMap(Effect.serviceOption(Store), (s) =>
    Option.isSome(s) ? Effect.succeed(s.value) : (Effect.fail(new MissingDependency({ tag: 'Store', service: hook, missing: 'Store', message: `"${hook}" requires "Store", which is not provided` })) as unknown as Effect.Effect<never>),
  )

/** Reads an atom and registers it as a dependency of the running component instance. */
export const useAtomValue = <A>(atom: Atom.Atom<A>): Effect.Effect<A, never, Store> =>
  Effect.flatMap(store('useAtomValue'), (s) =>
    Effect.map(Collector, (c) => {
      c?.add(atom)
      return s.get(atom)
    }),
  )

/** Returns a setter for `atom`; registers nothing. */
export const useSetAtom = <R, W>(atom: Atom.Writable<R, W>): Effect.Effect<(value: W) => void, never, Store> =>
  Effect.map(store('useSetAtom'), (s) => (value: W) => s.set(atom, value))

/** `[value, set]`, like `useState`. */
export const useAtom = <R, W>(atom: Atom.Writable<R, W>): Effect.Effect<readonly [R, (value: W) => void], never, Store> =>
  Effect.zip(useAtomValue(atom), useSetAtom(atom))

// A re-run is outside any `Catch` frame: apply the innermost captured `Boundary` handler whose tag matches.
const handled = (run: Effect.Effect<Node, any, any>): Effect.Effect<Node, any, any> =>
  Effect.catchIf(
    run,
    (e: any) => typeof e?._tag === 'string',
    (e: any) =>
      Effect.flatMap(Handlers, (hs) => {
        const h = [...hs].reverse().find((x) => x.tag === e._tag)
        return h ? h.fallback(e) : Effect.fail(e)
      }),
  )

/** Runs a component as one instance: fresh collector, own scope, captured context; returns a `Reactive` node when it read atoms. */
export const instance = <P>(type: (props: P) => Effect.Effect<Node, any, any>, props: P): Effect.Effect<Node, any, any> => {
  const run = (prev: Scope.CloseableScope | undefined): Effect.Effect<Node, any, any> =>
    Effect.flatMap(Effect.context<never>(), (ctx) => {
      const body = (own: Scope.CloseableScope | undefined): Effect.Effect<Node, any, any> => {
        const atoms = new Set<Atom.Atom<any>>()
        const scoped = own ? Effect.provideService(type(props), RenderScope, own) : type(props)
        return Effect.map(Effect.provideService(scoped, Collector, atoms), (child): Node =>
          atoms.size === 0 ? child : { _tag: 'Reactive', atoms: [...atoms], child, rerun: Effect.provide(handled(run(own)), ctx) as Effect.Effect<Node> },
        )
      }
      return Effect.flatMap(RenderScope, (parent) =>
        parent
          ? Effect.flatMap(Scope.fork(parent, ExecutionStrategy.sequential), (own) =>
              Effect.onExit(body(own), (exit) => (Exit.isSuccess(exit) ? (prev ? Scope.close(prev, Exit.void) : Effect.void) : Scope.close(own, exit))),
            )
          : body(undefined),
      )
    })
  return run(undefined)
}
