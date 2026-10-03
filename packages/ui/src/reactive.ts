import { type Atom, type AtomStore, MissingDependency } from '@sleekstack/core'
import { Context, Effect, Option } from 'effect'
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

/** Runs a component as one instance: fresh collector, captured context; returns a `Reactive` node when it read atoms. */
export const instance = <P>(type: (props: P) => Effect.Effect<Node, any, any>, props: P): Effect.Effect<Node, any, any> => {
  const run: Effect.Effect<Node, any, any> = Effect.flatMap(Effect.context<never>(), (ctx) => {
    const atoms = new Set<Atom.Atom<any>>()
    return Effect.map(Effect.provideService(type(props), Collector, atoms), (child): Node =>
      atoms.size === 0 ? child : { _tag: 'Reactive', atoms: [...atoms], child, rerun: Effect.provide(run, ctx) as Effect.Effect<Node> },
    )
  })
  return run
}
