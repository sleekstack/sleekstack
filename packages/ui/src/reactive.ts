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
  /** Last committed run of a keyed instance that read no atom and never used its scope, for reuse when its props and context match. */
  memo?: Memo
  /** Stable stand-ins for a keyed instance's `on[A-Z]` function props, each forwarding to the newest closure. */
  handlers?: Map<string, { current: Function; readonly fn: Function }>
  /** A run is in flight / a handler was called while it was. */
  running?: boolean
  called?: boolean
}
interface Memo {
  readonly props: object
  readonly ctx: Context.Context<never>
  readonly node: Node
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
  s.memo = undefined
  s.handlers = undefined
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



/** A scope that forks `parent` on first use. Used after it closed, it behaves like a closed scope: finalizers run at once. */
class LazyScope {
  readonly [Scope.ScopeTypeId] = Scope.ScopeTypeId
  readonly [Scope.CloseableScopeTypeId] = Scope.CloseableScopeTypeId
  readonly strategy = ExecutionStrategy.sequential
  private inner: Scope.CloseableScope | undefined
  private closed = false
  constructor(private readonly parent: Scope.Scope) {}
  private real(): Scope.CloseableScope {
    if (this.inner) return this.inner
    this.inner = Effect.runSync(Scope.fork(this.parent, ExecutionStrategy.sequential))
    if (this.closed) Effect.runSync(Scope.close(this.inner, Exit.void))
    return this.inner
  }
  fork(strategy: ExecutionStrategy.ExecutionStrategy) {
    return Effect.suspend(() => (this.real() as any).fork(strategy) as Effect.Effect<Scope.CloseableScope>)
  }
  addFinalizer(finalizer: Scope.Scope.Finalizer) {
    return Effect.suspend(() => (this.real() as any).addFinalizer(finalizer) as Effect.Effect<void>)
  }
  close(exit: Exit.Exit<unknown, unknown>) {
    this.closed = true
    return this.inner ? Scope.close(this.inner, exit) : Effect.void
  }
  /** Closes without a fiber when nothing ever used the scope; false when it was used (close it normally). */
  closeIfIdle(): boolean {
    if (this.inner) return false
    this.closed = true
    return true
  }
  /** Never forked its parent and not closed. */
  isIdle(): boolean {
    return !this.inner && !this.closed
  }
}
const lazyScope = (parent: Scope.Scope): Scope.CloseableScope => new LazyScope(parent) as unknown as Scope.CloseableScope
/** Closes `scope` without a fiber when it is a lazy scope nothing used; true when that handled it. */
export const closeIdle = (scope: Scope.CloseableScope): boolean => (scope as unknown) instanceof LazyScope && (scope as unknown as LazyScope).closeIfIdle()
const isIdle = (scope: Scope.Scope | undefined): boolean => (scope as unknown) instanceof LazyScope && (scope as unknown as LazyScope).isIdle()

// Per-run services: rebuilt for every parent run, so they never decide whether a child's inputs changed.
const NO_ATOMS: ReadonlyArray<never> = []
const PER_RUN = new Set<string>([Collector.key, Frame.key, RenderScope.key])
const sameProps = (a: object, b: object): boolean => {
  if (a === b) return true
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  for (const k of ka) if (!Object.hasOwn(b, k) || !Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false
  return true
}
const sameServices = (a: Context.Context<never>, b: Context.Context<never>): boolean => {
  let n = 0
  for (const [k, v] of a.unsafeMap) {
    if (PER_RUN.has(k)) continue
    n++
    if (!b.unsafeMap.has(k) || !Object.is(b.unsafeMap.get(k), v)) return false
  }
  for (const k of b.unsafeMap.keys()) if (!PER_RUN.has(k)) n--
  return n === 0
}


const HANDLER_PROP = /^on[A-Z]/
/**
 * A keyed instance's `on[A-Z]` function props are replaced by stable wrappers that call the newest closure, so a fresh
 * inline handler per parent run does not change the props. A wrapper called while the row runs marks the row (`called`):
 * its output may depend on the handler, so it is not remembered.
 */
const stableHandlers = <P extends object>(slots: Slots, props: P): P => {
  let out: Record<string, unknown> | undefined
  const src = props as Record<string, unknown>
  for (const k of Object.keys(src)) {
    const v = src[k]
    if (typeof v !== 'function' || !HANDLER_PROP.test(k)) continue
    let h = slots.handlers?.get(k)
    if (!h) {
      const w: { current: Function; readonly fn: Function } = {
        current: v,
        fn: (...args: Array<unknown>) => {
          if (slots.running) slots.called = true
          return w.current(...args)
        },
      }
      ;(slots.handlers ??= new Map()).set(k, (h = w))
    }
    h.current = v
    ;(out ??= { ...src })[k] = h.fn
  }
  return (out ?? props) as P
}

/**
 * Runs a component as one instance: fresh collector, own scope, captured context; returns a `Reactive` node when it read atoms.
 * Under a `RenderScope` the node carries its run's scope: a failed run closes it, otherwise its owner (the DOM renderer) does.
 */
export const instance = <P>(type: (props: P) => Effect.Effect<Node, any, any>, props: P, key?: string): Effect.Effect<Node, any, any> => {
  // Fixed on the first run from the parent's frame; `rerun` reuses it and never bumps the parent's ordinals.
  let id: string | undefined
  // Slots of an instance with no parent frame (the root).
  let rootSlots: Slots | undefined
  // The props a run gives `type`: the call's own on the first run, with keyed handlers made stable; re-runs reuse them.
  let effProps: P = props
  const run: Effect.Effect<Node, any, any> = Effect.flatMap(Effect.context<never>(), (ctx) => {
    const first = id === undefined
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
      if (first && key !== undefined) effProps = stableHandlers(slots, props as object) as P
      // Unchanged props and services, and a scope nothing used: the last run's node stands (nothing it read can have changed).
      const m = slots.memo
      if (m && key !== undefined && isIdle((m.node as { scope?: Scope.Scope }).scope) && sameProps(m.props, effProps as object) && sameServices(m.ctx, ctx)) return Effect.succeed(m.node)
    } else slots = rootSlots ??= { atoms: [], releases: [], done: false }
    const frame = makeFrame(slots, self)
    const body = (own: Scope.CloseableScope | undefined): Effect.Effect<Node, any, any> => {
      const reads = new Reads(slots)
      slots.running = true
      slots.called = false
      // One map copy for the three per-run services (Context.add copies per call).
      const map = new Map(ctx.unsafeMap)
      map.set(Collector.key, reads)
      map.set(Frame.key, frame)
      if (own) map.set(RenderScope.key, own)
      const inner = Context.unsafeMake(map)
      // One continuation: check the slot count, then build the node.
      return Effect.flatMap(Effect.provide(type(effProps), inner), (child): Effect.Effect<Node, SlotMismatch> => {
        if (slots.done && frame.cursor !== slots.atoms.length) return Effect.fail(new SlotMismatch({ id: self, expected: slots.atoms.length, actual: frame.cursor }))
        slots.done = true
        slots.running = false
        if (reads.size === 0 && key === undefined) return Effect.succeed(own ? owned(child, own) : child)
        const read = reads.size > 0
        // A run that read no atom is never re-run by the renderer, so its `rerun` is built only if asked for.
        const node: Node = {
          _tag: 'Reactive',
          atoms: read ? [...reads.keys()] : NO_ATOMS,
          seen: read ? [...reads.values()] : NO_ATOMS,
          child,
          scope: own,
          rerun: (read ? Effect.provide(handled(run), ctx) : Effect.suspend(() => Effect.provide(handled(run), ctx))) as Effect.Effect<Node>,
          id: self,
          frame,
          ...(key !== undefined && { key }),
        }
        // Remembered for the next parent run only when nothing the row did can change without it re-running: no atom read, scope unused.
        slots.memo = parentFrame && key !== undefined && !read && !slots.called && isIdle(own) ? { props: effProps as object, ctx, node } : undefined
        return Effect.succeed(node)
      })
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
