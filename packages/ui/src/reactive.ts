import { Atom, type AtomStore, MissingDependency } from '@sleekstack/core'
import { Context, Data, Effect, ExecutionStrategy, Exit, Option, Scope } from 'effect'
import type { Node } from './node'

/** The mount's atom store. `mount` and `renderToString` provide it. */
export class Store extends Effect.Tag('Store')<Store, AtomStore>() {}

/** Atoms read by one run of a component instance; `id` is the instance's identity, the same object across its re-runs. */
export class Reads extends Map<Atom.Atom<any>, unknown> {
  constructor(readonly id: object) { super() }
}

/** The reads of the component run in progress; `undefined` outside a wrapped instance. */
export class Collector extends Context.Reference<Collector>()('@sleekstack/ui/Collector', {
  defaultValue: (): Reads | undefined => undefined,
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

/** Local-state slots of one instance id, kept in its parent's registry (`kids`) across re-runs of both. */
export interface Slots {
  readonly atoms: Array<Atom.Writable<any>>
  readonly releases: Array<() => void>
  /** Slot count fixed by a finished run; later runs must match it. */
  done: boolean
  kids?: Map<string, Slots>
}

/** One run of an instance: ordinals by component function, its own slots and cursor, and what its children did. `undefined` at the root. */
export interface RunFrame {
  readonly ordinals: Map<Function, number>
  readonly owner: Slots
  readonly id: string
  cursor: number
  /** Child ids that ran in this run. */
  seen?: Set<string>
  /** Child slots created by this run; disposed if the run is dropped. */
  pending?: Array<readonly [string, Slots]>
}

export class Frame extends Context.Reference<Frame>()('@sleekstack/ui/Frame', {
  defaultValue: (): RunFrame | undefined => undefined,
}) {}

export const makeFrame = (owner: Slots = { atoms: [], releases: [], done: false }, id = ''): RunFrame => ({ ordinals: new Map(), owner, id, cursor: 0 })

/** A run called a different number of `useLocal`s than the instance's previous run. */
export class SlotMismatch extends Data.TaggedError('SlotMismatch')<{ readonly id: string; readonly expected: number; readonly actual: number }> {}
/** Two siblings share one key. */
export class DuplicateKey extends Data.TaggedError('DuplicateKey')<{ readonly key: string }> {}

/** Releases a slot tree and resets it, so a disposed instance id starts fresh; idempotent. */
export const disposeSlots = (s: Slots): void => {
  for (const r of s.releases.splice(0)) r()
  s.atoms.length = 0
  s.done = false
  s.kids?.forEach(disposeSlots)
  s.kids = undefined
}

/** The run's result committed: its pending slots become permanent; slots of child ids it did not run are disposed. */
export const commitSlots = (frame: RunFrame): void => {
  frame.pending = undefined
  frame.owner.kids?.forEach((s, id) => {
    if (!frame.seen?.has(id)) {
      disposeSlots(s)
      frame.owner.kids!.delete(id)
    }
  })
}

/** The run was dropped: dispose the slots it created; earlier slots stay. */
export const dropSlots = (frame: RunFrame): void => {
  for (const [id, s] of frame.pending ?? []) {
    disposeSlots(s)
    frame.owner.kids?.delete(id)
  }
  frame.pending = undefined
}

const fnIds = new WeakMap<Function, string>()
let nextFn = 0
const fnId = (f: Function): string => {
  let id = fnIds.get(f)
  if (id === undefined) fnIds.set(f, (id = String(nextFn++)))
  return id
}

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

/** Instance-local state: slot *n* is the *n*-th call of the run. Outside an instance, `initial` and a no-op setter. */
export const useLocal = <A>(initial: A): Effect.Effect<readonly [A, (next: A | ((previous: A) => A)) => void], never, Store> =>
  Effect.flatMap(Collector, (c) =>
    c === undefined
      ? Effect.succeed([initial, () => {}] as const)
      : Effect.flatMap(store('useLocal'), (s) =>
          Effect.flatMap(Frame, (f) => {
            const slots = f!.owner
            const i = f!.cursor++
            if (i >= slots.atoms.length) {
              if (slots.done) return Effect.fail(new SlotMismatch({ id: f!.id, expected: slots.atoms.length, actual: i + 1 })) as unknown as Effect.Effect<never>
              const a = Atom.writable<A, A>(() => initial, (ctx, v) => ctx.setSelf(v))
              slots.atoms.push(a)
              slots.releases.push(s.retain(a))
            }
            const atom = slots.atoms[i] as Atom.Writable<A>
            return Effect.map(useAtomValue(atom), (value) => [value, (next: A | ((previous: A) => A)) => (typeof next === 'function' ? s.update(atom, next as (p: A) => A) : s.set(atom, next))] as const)
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



interface LazyScope extends Scope.CloseableScope {
  /** Closes without a fiber when nothing ever used the scope; false when it was used (close it normally). */
  closeIfIdle(): boolean
}
const lazies = new WeakSet<object>()

/** A scope that forks `parent` on first use. Used after it closed, it behaves like a closed scope: finalizers run at once. */
const lazyScope = (parent: Scope.Scope): Scope.CloseableScope => {
  let inner: Scope.CloseableScope | undefined
  let closed = false
  const real = (): Scope.CloseableScope => {
    if (inner) return inner
    inner = Effect.runSync(Scope.fork(parent, ExecutionStrategy.sequential))
    if (closed) Effect.runSync(Scope.close(inner, Exit.void))
    return inner
  }
  const self = {
    [Scope.ScopeTypeId]: Scope.ScopeTypeId,
    [Scope.CloseableScopeTypeId]: Scope.CloseableScopeTypeId,
    strategy: ExecutionStrategy.sequential,
    fork: (strategy: ExecutionStrategy.ExecutionStrategy) => Effect.suspend(() => (real() as any).fork(strategy) as Effect.Effect<Scope.CloseableScope>),
    addFinalizer: (finalizer: Scope.Scope.Finalizer) => Effect.suspend(() => (real() as any).addFinalizer(finalizer) as Effect.Effect<void>),
    close: (exit: Exit.Exit<unknown, unknown>) => {
      closed = true
      return inner ? Scope.close(inner, exit) : Effect.void
    },
    closeIfIdle: () => {
      if (inner) return false
      closed = true
      return true
    },
  } as unknown as LazyScope
  lazies.add(self)
  return self
}
/** Closes `scope` without a fiber when it is a lazy scope nothing used; true when that handled it. */
export const closeIdle = (scope: Scope.CloseableScope): boolean => lazies.has(scope) && (scope as LazyScope).closeIfIdle()

/**
 * Runs a component as one instance: fresh collector, own scope, captured context; returns a `Reactive` node when it read atoms.
 * Under a `RenderScope` the node carries its run's scope: a failed run closes it, otherwise its owner (the DOM renderer) does.
 */
export const instance = <P>(type: (props: P) => Effect.Effect<Node, any, any>, props: P, key?: string): Effect.Effect<Node, any, any> => {
  // Fixed on the first run from the parent's frame; `rerun` reuses it and never bumps the parent's ordinals.
  let id: string | undefined
  // Slots of an instance with no parent frame (the root).
  let rootSlots: Slots | undefined
  const run: Effect.Effect<Node, any, any> = Effect.flatMap(Effect.context<never>(), (ctx) => {
    if (id === undefined) {
      if (key === undefined) {
        // Keyed calls take no ordinal: unkeyed siblings keep their ids when a keyed one comes or goes.
        const frame = Context.get(ctx, Frame)
        const ordinal = frame?.ordinals.get(type) ?? 0
        frame?.ordinals.set(type, ordinal + 1)
        id = `${fnId(type)}#${ordinal}`
      } else id = `${fnId(type)}:key:${key}`
    }
    const self = id
    const parentFrame = Context.get(ctx, Frame)
    let slots: Slots
    if (parentFrame) {
      ;(parentFrame.seen ??= new Set()).add(self)
      const kids = (parentFrame.owner.kids ??= new Map())
      let found = kids.get(self)
      if (found === undefined) {
        kids.set(self, (found = { atoms: [], releases: [], done: false }))
        ;(parentFrame.pending ??= []).push([self, found])
      }
      slots = found
    } else slots = rootSlots ??= { atoms: [], releases: [], done: false }
    const frame = makeFrame(slots, self)
    const body = (own: Scope.CloseableScope | undefined): Effect.Effect<Node, any, any> => {
      const reads = new Reads(slots)
      let inner = Context.add(Context.add(ctx, Collector, reads), Frame, frame)
      if (own) inner = Context.add(inner, RenderScope, own)
      const checked = Effect.flatMap(Effect.provide(type(props), inner), (child) => {
        if (slots.done && frame.cursor !== slots.atoms.length) return Effect.fail(new SlotMismatch({ id: self, expected: slots.atoms.length, actual: frame.cursor }))
        slots.done = true
        return Effect.succeed(child)
      })
      return Effect.map(checked, (child): Node =>
        reads.size === 0 && key === undefined
          ? own
            ? owned(child, own)
            : child
          : { _tag: 'Reactive', atoms: [...reads.keys()], seen: [...reads.values()], child, scope: own, rerun: Effect.provide(handled(run), ctx) as Effect.Effect<Node>, id: self, frame, ...(key !== undefined && { key }) },
      )
    }
    const parent = Context.get(ctx, RenderScope)
    if (!parent) return body(undefined)
    // The run's scope forks `parent` only when something uses it (a Provider, a retained atom, ...); most rows never do.
    const own = lazyScope(parent)
    // A failed or interrupted run produces no node for the renderer to drop: its pending child slots go here too.
    return Effect.onExit(body(own), (exit) => (Exit.isSuccess(exit) ? Effect.void : Effect.zipRight(Effect.sync(() => dropSlots(frame)), Scope.close(own, exit))))
  })
  return run
}
