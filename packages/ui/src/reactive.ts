import { Atom, type AtomStore, MissingDependency, type Result } from '@sleekstack/core'
import { Cause, Context, Data, Effect, ExecutionStrategy, Exit, Fiber, Option, Scope } from 'effect'
import type { YieldWrap } from 'effect/Utils'
import type { Node, ReactiveNode, Ref } from './node'

/** What a component returns: an Effect, or a generator that `yield*`s Effects and returns the element (run as `Effect.gen`). */
export type ComponentResult =
  | Effect.Effect<Node, any, any>
  | Generator<YieldWrap<Effect.Effect<any, any, any>>, Effect.Effect<Node, any, any> | Node, any>

const isGenerator = (r: unknown): r is Generator<unknown, unknown, unknown> =>
  typeof r === 'object' && r !== null && typeof (r as { next?: unknown }).next === 'function' && !Effect.isEffect(r)

// A generator component is run as `Effect.gen`; the element it returns (an Effect, as every JSX expression is) is run in turn.
const call = <P>(type: (props: P) => ComponentResult, props: P): Effect.Effect<Node, any, any> => {
  const r = type(props)
  if (!isGenerator(r)) return r as Effect.Effect<Node, any, any>
  return Effect.gen(function* () {
    const out: unknown = yield* r as Generator<any, unknown, any>
    return (Effect.isEffect(out) ? yield* out : out) as Node
  })
}

/** The mount's atom store. `mount` and `renderToString` provide it. */
export class Store extends Effect.Tag('Store')<Store, AtomStore>() {}

/** Atoms read by one run of a component instance; `id` is the instance's identity, the same object across its re-runs. */
export class Reads extends Map<Atom.Atom<any>, unknown> {
  constructor(readonly id: object) {
    super()
  }
}

/** The reads of the component run in progress; `undefined` outside a wrapped instance. */
export class Collector extends Context.Reference<Collector>()('@sleekstack/ui/Collector', {
  defaultValue: (): Reads | undefined => undefined,
}) {}

/** Enclosing `Boundary` handlers, innermost last; captured with an instance's context for its re-runs. */
export class Handlers extends Context.Reference<Handlers>()('@sleekstack/ui/Handlers', {
  defaultValue: (): ReadonlyArray<{
    readonly tag: string
    readonly fallback: (error: any) => Effect.Effect<Node, any, any>
  }> => [],
}) {}

/**
 * Lifetime of `Provider` layers. When set (by `mount`), each component run gets a child scope and its layers are
 * built there, so services captured for a re-run stay alive; a run's scope closes when the next run of the same
 * instance succeeds, when that run fails, or with its parent. Unset, a `Provider` layer lives only for the render.
 */
export class RenderScope extends Context.Reference<RenderScope>()('@sleekstack/ui/RenderScope', {
  defaultValue: (): Scope.Scope | undefined => undefined,
}) {}

/**
 * The mount's own scope. A component run's scope normally forks `RenderScope` (the enclosing run's scope) and closes with it;
 * a scope that is lent (a keyed row, or any run that reads an atom) forks this instead, so a row the parent skips keeps its
 * resources when the parent's previous run closes. The renderer closes a lent scope when its row is replaced or removed.
 */
export class MountScope extends Context.Reference<MountScope>()('@sleekstack/ui/MountScope', {
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
  readonly scope?: Scope.Scope
  /** Host-only fast path: the element's type and props the node was built from. */
  readonly host?: HostDescriptor
}

/** One run of an instance: ordinals by component function, its own slots and cursor, and what its children did. `undefined` at the root. */
export interface RunFrame {
  /** Created by the first unkeyed child. */
  ordinals?: Map<Function, number>
  readonly owner: Slots
  readonly id: string
  cursor: number
  /** Child ids that ran in this run. */
  seen?: Set<string>
  /** Child slots created by this run; disposed if the run is dropped. */
  pending?: Array<readonly [string, Slots]>
  /** Scopes lent to the mount by this run's children; closed if this run fails, forgotten once it succeeds (the node tree owns them). */
  leased?: Array<Scope.CloseableScope>
  /** `useEffect` work this run queued; the renderer runs it after the run's DOM is committed, and `dropSlots` discards it. */
  effects?: Array<() => void>
  /** The run called `useEffect` (on the server too), so its result is an instance node there as well as on the client. */
  effectful?: boolean
}

export class Frame extends Context.Reference<Frame>()('@sleekstack/ui/Frame', {
  defaultValue: (): RunFrame | undefined => undefined,
}) {}

export const makeFrame = (
  owner: Slots = {
    atoms: [],
    releases: [],
    done: false,
  },
  id = '',
): RunFrame => ({ owner, id, cursor: 0 })

/** A run called a different number of `useLocal`s than the instance's previous run. */
export class SlotMismatch extends Data.TaggedError('SlotMismatch')<{
  readonly id: string
  readonly expected: number
  readonly actual: number
}> {}

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
  frame.leased = undefined
  frame.owner.kids?.forEach((s, id) => {
    if (!frame.seen?.has(id)) {
      disposeSlots(s)
      frame.owner.kids!.delete(id)
    }
  })
}

/** Runs (once) the `useEffect` work a committed run queued. */
export const flushEffects = (frame: RunFrame): void => {
  const queued = frame.effects
  frame.effects = undefined
  if (queued) for (const run of queued) run()
}

/** The run was dropped: dispose the slots it created; earlier slots stay. */
export const dropSlots = (frame: RunFrame): void => {
  frame.effects = undefined
  for (const scope of frame.leased ?? []) closeNow(scope)
  frame.leased = undefined
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
const missingStore = (hook: string): Effect.Effect<never> =>
  Effect.fail(
    new MissingDependency({
      tag: 'Store',
      service: hook,
      missing: 'Store',
      message: `"${hook}" requires "Store", which is not provided`,
    }),
  ) as unknown as Effect.Effect<never>
const store = (hook: string): Effect.Effect<AtomStore, never, Store> =>
  Effect.flatMap(Effect.serviceOption(Store), (s) => (Option.isSome(s) ? Effect.succeed(s.value) : missingStore(hook)))

/** Reads an atom and registers it as a dependency of the running component instance. */
export const useAtomValue = <A>(atom: Atom.Atom<A>): Effect.Effect<A, never, Store> =>
  // One context read for the three services a hook needs.
  Effect.flatMap(Effect.context<never>(), (ctx) => {
    const so = Context.getOption(ctx, Store)
    if (Option.isNone(so)) return missingStore('useAtomValue') as Effect.Effect<A>
    const s = so.value
    const c = Context.get(ctx, Collector)
    const scope = Context.get(ctx, RenderScope)
    const first = c !== undefined && !c.has(atom)
    const read = (): A => {
      const value = s.get(atom)
      if (first) c.set(atom, value)
      return value
    }
    // Hold the atom for the run's lifetime so it is not dropped (and reset) before the renderer subscribes.
    if (!(first && scope)) return Effect.succeed(read())
    lend(scope)
    const release = s.retain(atom)
    return Effect.zipRight(Scope.addFinalizer(scope, Effect.sync(release)), Effect.sync(read))
  })

/** Instance-local state: slot *n* is the *n*-th call of the run. Outside an instance, `initial` and a no-op setter. */
export const useLocal = <A>(
  initial: A,
): Effect.Effect<readonly [A, (next: A | ((previous: A) => A)) => void], never, Store> =>
  Effect.flatMap(Effect.context<never>(), (ctx) => {
    const c = Context.get(ctx, Collector)
    if (c === undefined) return Effect.succeed([initial, () => {}] as const)
    const so = Context.getOption(ctx, Store)
    if (Option.isNone(so)) return missingStore('useLocal') as Effect.Effect<never>
    const s = so.value
    const f = Context.get(ctx, Frame)!
    const slots = f.owner
    const i = f.cursor++
    if (i >= slots.atoms.length) {
      if (slots.done)
        return Effect.fail(
          new SlotMismatch({ id: f.id, expected: slots.atoms.length, actual: i + 1 }),
        ) as unknown as Effect.Effect<never>
      const a = Atom.writable<A, A>(
        () => initial,
        (cx, v) => cx.setSelf(v),
      )
      slots.atoms.push(a)
      slots.releases.push(s.retain(a))
    }
    const atom = slots.atoms[i] as Atom.Writable<A>
    // The slot atom is retained for the slot's lifetime above, so a run needs no hold of its own.
    const value = s.get(atom)
    if (!c.has(atom)) c.set(atom, value)
    return Effect.succeed([
      value,
      (next: A | ((previous: A) => A)) =>
        typeof next === 'function' ? s.update(atom, next as (p: A) => A) : s.set(atom, next),
    ] as const)
  })

/** Where `useEffect` reports a failure of its effect or cleanup; set by the mount from its `onError`. */
export class MountError extends Context.Reference<MountError>()('@sleekstack/ui/MountError', {
  defaultValue: (): ((cause: Cause.Cause<unknown>) => void) | undefined => undefined,
}) {}

/** What an effect may return: nothing, a cleanup function, or an Effect (run in its own `Scope`, ended as the cleanup). */
export type EffectResult<E = never, R = never> = void | (() => void) | Effect.Effect<void, E, R>

interface EffectSlot {
  started: boolean
  deps: ReadonlyArray<unknown> | undefined
  cleanup: (() => void) | undefined
  /** A generator effect is running (it follows the atoms it reads, not the component's runs). */
  tracked: boolean
  /** The latest committed `fn` of a generator effect: what an atom-driven re-run calls. */
  make: (() => Generator<any, unknown, any>) | undefined
  /** Restarts a running generator effect in place (its atoms stay held). */
  restart: (() => void) | undefined
}

const sameDeps = (a: ReadonlyArray<unknown>, b: ReadonlyArray<unknown>): boolean =>
  a.length === b.length && a.every((x, i) => Object.is(x, b[i]))

/** The atoms a generator effect reads: each is subscribed when first read, and a change re-runs the effect. */
class EffectReads extends Reads {
  constructor(private readonly onNew: (atom: Atom.Atom<any>) => void) {
    super({})
  }
  override set(atom: Atom.Atom<any>, value: unknown): this {
    if (!this.has(atom)) this.onNew(atom)
    return super.set(atom, value)
  }
}

/**
 * Runs a generator effect and follows it: it runs as `Effect.gen` in its own `Scope` with the component's context,
 * recording the atoms it reads (`yield* useAtomValue(a)`, also after an `await`). A change to one of them (batched into one
 * microtask) ends the run (interrupt, scope closed: its finalizers are the cleanup) and starts it again, from `slot.make`.
 * The returned function ends it for good.
 */
const track = (
  slot: EffectSlot,
  first: Generator<any, unknown, any>,
  ctx: Context.Context<never>,
  store: AtomStore,
  report: ((cause: Cause.Cause<unknown>) => void) | undefined,
): { readonly restart: () => void; readonly stop: () => void } => {
  let stop: Effect.Effect<void> | undefined
  let dead = false
  let queued = false
  let closing = false
  let pending: Generator<any, unknown, any> | undefined = first
  // Atoms stay held across restarts (until the effect ends): between runs nothing else holds them, and an idle atom is reset.
  const held = new Map<Atom.Atom<any>, () => void>()
  // The previous run is fully ended (finalizers done) before the next one starts; changes meanwhile fold into that start.
  const restart = () => {
    if (closing) return
    closing = true
    const end = stop ?? Effect.void
    stop = undefined
    Effect.runFork(
      Effect.zipRight(
        end,
        Effect.sync(() => {
          closing = false
          if (!dead) start()
        }),
      ),
    )
  }
  const changed = () => {
    if (dead || queued) return
    queued = true
    queueMicrotask(() => {
      queued = false
      if (!dead) restart()
    })
  }
  const start = () => {
    const gen = pending ?? slot.make!()
    pending = undefined
    const scope = Effect.runSync(Scope.make())
    const unsubs: Array<() => void> = []
    const reads = new EffectReads((atom) => {
      if (!held.has(atom)) held.set(atom, store.retain(atom))
      unsubs.push(store.subscribe(atom, changed))
    })
    const fiber = Effect.runFork(
      Effect.gen(() => gen).pipe(
        Effect.provideService(Scope.Scope, scope),
        Effect.provideService(RenderScope, scope),
        Effect.provideService(Collector, reads),
        // Slot hooks (`useLocal`, ...) belong to components: inside an effect they get a frame of their own.
        Effect.provideService(Frame, makeFrame()),
        Effect.provide(ctx),
        Effect.catchAllCause((cause) =>
          Cause.isInterruptedOnly(cause) ? Effect.void : Effect.sync(() => report?.(cause)),
        ),
      ) as Effect.Effect<void>,
    )
    stop = Effect.zipRight(
      Effect.sync(() => unsubs.splice(0).forEach((u) => u())),
      Effect.zipRight(Fiber.interrupt(fiber), Scope.close(scope, Exit.void)),
    )
  }
  start()
  const end = () => {
    dead = true
    const last = stop
    stop = undefined
    Effect.runFork(
      Effect.zipRight(
        last ?? Effect.void,
        Effect.sync(() => held.forEach((release) => release())),
      ),
    )
  }
  return { restart, stop: end }
}

/** The requirements a generator effect's yields add. */
type YieldedContext<Y> = Y extends YieldWrap<Effect.Effect<any, any, infer R>> ? R : never

/**
 * `useEffect(fn, deps?)`, as in React: `fn` runs after the DOM of an instance's first run is committed and again when `deps` change (every run when
 * omitted; once for `[]`). Its returned cleanup runs before the next `fn` and when the instance is removed or the mount
 * disposed (not awaited). `fn` may be an Effect itself (or return one): it runs with the run's context in its own `Scope`
 * (`Effect.addFinalizer` / `acquireRelease` work), and is interrupted as the cleanup. A throw or failure goes to `onError`.
 *
 * `fn` may also be a generator function: it runs like an Effect, and follows the atoms it reads (`yield* useAtomValue(a)`)
 * instead of `deps`: when one changes, its scope closes (the finalizers are the cleanup) and it runs again. Without `deps` it
 * is not re-run by the component's own runs (it uses its latest closure when an atom re-runs it); with `deps` it also
 * restarts when they change. Plain values (props) are not tracked: list them in `deps`.
 *
 * Not run by `renderToString` / `renderToStream`. Takes a slot like `useLocal`, so call it unconditionally.
 * A run that is dropped (it failed, or a newer one replaced it) never runs its effects.
 */
export function useEffect<Y extends YieldWrap<Effect.Effect<any, any, any>>>(
  fn: () => Generator<Y, unknown, any>,
  deps?: ReadonlyArray<unknown>,
): Effect.Effect<void, never, Exclude<YieldedContext<Y>, Scope.Scope> | Store>
export function useEffect<E = never, R = never>(
  fn: (() => EffectResult<E, R>) | Effect.Effect<void, E, R>,
  deps?: ReadonlyArray<unknown>,
): Effect.Effect<void, never, Exclude<R, Scope.Scope> | Store>
export function useEffect(fn: any, deps?: ReadonlyArray<unknown>): Effect.Effect<void, never, any> {
  return Effect.flatMap(Effect.context<never>(), (ctx) => {
    if (Context.get(ctx, Collector) === undefined) return Effect.void
    const f = Context.get(ctx, Frame)!
    f.effectful = true
    // Only a mount provides `MountScope`: a string or stream render never runs it.
    if (Context.get(ctx, MountScope) === undefined) return Effect.void
    const so = Context.getOption(ctx, Store)
    if (Option.isNone(so)) return missingStore('useEffect') as Effect.Effect<never>
    const slots = f.owner
    const i = f.cursor++
    const first = i >= slots.atoms.length
    if (first && slots.done)
      return Effect.fail(
        new SlotMismatch({ id: f.id, expected: slots.atoms.length, actual: i + 1 }),
      ) as unknown as Effect.Effect<never>
    // The slot holds one mutable record that nothing reads, so a run never makes the instance depend on it.
    if (first)
      slots.atoms.push(
        Atom.make<EffectSlot>({
          started: false,
          deps: undefined,
          cleanup: undefined,
          tracked: false,
          make: undefined,
          restart: undefined,
        }),
      )
    const slot = so.value.get(slots.atoms[i] as Atom.Atom<EffectSlot>)
    const report = Context.get(ctx, MountError)
    const end = () => {
      const c = slot.cleanup
      slot.cleanup = undefined
      try {
        c?.()
      } catch (e) {
        report?.(Cause.die(e))
      }
    }
    if (first) slots.releases.push(end)
    // Queued, not run: the renderer runs it once this run's DOM is committed; a dropped run never does.
    ;(f.effects ??= []).push(() => {
      // A generator effect follows its atoms: a component run only refreshes the closure it re-runs from.
      if (slot.tracked && !Effect.isEffect(fn)) slot.make = fn as () => Generator<any, unknown, any>
      if (slot.started) {
        const same = deps !== undefined && slot.deps !== undefined && sameDeps(slot.deps, deps)
        if (slot.tracked ? deps === undefined || same : same) return
        // Changed deps restart a generator effect in place, so the atoms it holds are not released in between.
        if (slot.tracked && slot.restart) return void ((slot.deps = deps), slot.restart())
      }
      end()
      slot.restart = undefined
      slot.started = true
      slot.tracked = false
      slot.deps = deps
      try {
        const r = Effect.isEffect(fn) ? fn : fn()
        if (typeof r === 'function') slot.cleanup = r
        else if (isGenerator(r)) {
          slot.tracked = true
          slot.make = fn as () => Generator<any, unknown, any>
          const t = track(slot, r as Generator<any, unknown, any>, ctx, so.value, report)
          slot.cleanup = t.stop
          slot.restart = t.restart
        } else if (Effect.isEffect(r)) {
          const scope = Effect.runSync(Scope.make())
          const fiber = Effect.runFork(
            (r as Effect.Effect<void, any, any>).pipe(
              Effect.provideService(Scope.Scope, scope),
              Effect.provide(ctx),
              Effect.catchAllCause((cause) =>
                Cause.isInterruptedOnly(cause) ? Effect.void : Effect.sync(() => report?.(cause)),
              ),
            ) as Effect.Effect<void>,
          )
          slot.cleanup = () =>
            void Effect.runFork(Effect.zipRight(Fiber.interrupt(fiber), Scope.close(scope, Exit.void)))
        }
      } catch (e) {
        report?.(Cause.die(e))
      }
    })
    return Effect.void
  })
}

/** The errors a generator's yields add. */
type YieldedError<Y> = Y extends YieldWrap<Effect.Effect<any, infer E, any>> ? E : never

// The latest `source` of each hook-made derived atom: a recompute uses the newest closure, not the first run's.
const derivedSource = new WeakMap<Atom.Atom<any>, { source: any }>()

const deriveAtom = (box: { source: any }, ctx: Context.Context<never>): Atom.Atom<any> => {
  const atom = Atom.make((get) => {
    const r = box.source(get)
    // Run in the component's context: the store's own context knows nothing of the app's layers.
    return isGenerator(r)
      ? Effect.provide(
          Effect.gen(() => r as Generator<any, unknown, any>),
          ctx,
        )
      : Effect.isEffect(r)
        ? Effect.provide(r, ctx)
        : r
  })
  derivedSource.set(atom, box)
  return atom
}

/**
 * A derived atom owned by this instance: one atom for the instance's whole life (the same object on every run), recomputed
 * when an atom it reads with `get` changes. Pass
 * - an Effect: it runs in the component's context (its services, `Layer`s above it), and the atom holds a `Result`;
 * - `(get) => Effect` or a generator function `function* (get) { … }` (yields run as `Effect.gen`): same, and `get(atom)`
 *   (read before the first async step) is a dependency;
 * - `(get) => value`: a plain derived atom.
 * The services it needs join the component's requirements (so the `Result`'s error has no `ScopeError`: they are provided). The context is the one of the first run, and the newest
 * closure is used when it recomputes. Takes a slot like `useLocal`, so call it unconditionally.
 */
export function useDerivedAtom<A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<Atom.Atom<Result.Result<A, E>>, never, R | Store>
export function useDerivedAtom<Y extends YieldWrap<Effect.Effect<any, any, any>>, A>(
  read: (get: Atom.Context) => Generator<Y, A, any>,
): Effect.Effect<Atom.Atom<Result.Result<A, YieldedError<Y>>>, never, YieldedContext<Y> | Store>
export function useDerivedAtom<A, E, R>(
  read: (get: Atom.Context) => Effect.Effect<A, E, R>,
): Effect.Effect<Atom.Atom<Result.Result<A, E>>, never, R | Store>
export function useDerivedAtom<A>(read: (get: Atom.Context) => A): Effect.Effect<Atom.Atom<A>, never, Store>
export function useDerivedAtom(source: any): Effect.Effect<Atom.Atom<any>, never, any> {
  return Effect.flatMap(Effect.context<never>(), (ctx) => {
    const wrapped = Effect.isEffect(source) ? () => source : source
    const f = Context.get(ctx, Frame)
    if (Context.get(ctx, Collector) === undefined || f === undefined)
      return Effect.succeed(deriveAtom({ source: wrapped }, ctx))
    const so = Context.getOption(ctx, Store)
    if (Option.isNone(so)) return missingStore('useDerivedAtom') as Effect.Effect<never>
    const slots = f.owner
    const i = f.cursor++
    if (i >= slots.atoms.length) {
      if (slots.done)
        return Effect.fail(
          new SlotMismatch({ id: f.id, expected: slots.atoms.length, actual: i + 1 }),
        ) as unknown as Effect.Effect<never>
      const atom = deriveAtom({ source: wrapped }, ctx)
      slots.atoms.push(atom as unknown as Atom.Writable<any>)
      slots.releases.push(so.value.retain(atom))
    }
    const atom = slots.atoms[i] as unknown as Atom.Atom<any>
    derivedSource.get(atom)!.source = wrapped
    return Effect.succeed(atom)
  })
}

/**
 * `useRef(initial?)`, as in React: a `{ current }` box that is the same object on every run of the instance and that
 * changing never re-runs it. Pass it as a host element's `ref` prop: `current` is the DOM element once it is attached
 * (before this commit's effects run) and `null` after it is removed. Takes a slot like `useLocal`, so call it unconditionally.
 */
export const useRef = <T = null>(initial: T | null = null): Effect.Effect<Ref<T>, never, Store> =>
  Effect.flatMap(Effect.context<never>(), (ctx) => {
    if (Context.get(ctx, Collector) === undefined) return Effect.succeed<Ref<T>>({ current: initial })
    const so = Context.getOption(ctx, Store)
    if (Option.isNone(so)) return missingStore('useRef') as Effect.Effect<never>
    const f = Context.get(ctx, Frame)!
    const slots = f.owner
    const i = f.cursor++
    if (i >= slots.atoms.length) {
      if (slots.done)
        return Effect.fail(
          new SlotMismatch({ id: f.id, expected: slots.atoms.length, actual: i + 1 }),
        ) as unknown as Effect.Effect<never>
      slots.atoms.push(Atom.make<Ref<T>>({ current: initial }))
    }
    return Effect.succeed(so.value.get(slots.atoms[i] as Atom.Atom<Ref<T>>))
  })

/** Returns a setter for `atom`; registers nothing. */
export const useSetAtom = <R, W>(atom: Atom.Writable<R, W>): Effect.Effect<(value: W) => void, never, Store> =>
  Effect.map(store('useSetAtom'), (s) => (value: W) => s.set(atom, value))

/** `[value, set]`, like `useState`. */
export const useAtom = <R, W>(
  atom: Atom.Writable<R, W>,
): Effect.Effect<readonly [R, (value: W) => void], never, Store> => Effect.zip(useAtomValue(atom), useSetAtom(atom))

/** Run scopes of components that read no atoms, keyed by a fresh wrapper around their output; the renderer owns them. */
export const runScopes = new WeakMap<Node, Scope.CloseableScope>()

/** Fresh wrappers around what a re-run produced from a `Boundary` fallback rather than from the component itself. */
export const fallbacks = new WeakSet<Node>()
const asFallback = (n: Node): Node => {
  const wrapped: Node = { _tag: 'Fragment', children: [n] }
  fallbacks.add(wrapped)
  return wrapped
}

export const owned = (child: Node, scope: Scope.CloseableScope): Node => {
  const wrapped: Node = { _tag: 'Fragment', children: [child] }
  runScopes.set(wrapped, scope)
  return wrapped
}

// Runs a fallback in its own child of `RenderScope`, owned by the renderer like an untracked run.
export const scopedRun = (run: Effect.Effect<Node, any, any>): Effect.Effect<Node, any, any> =>
  Effect.flatMap(RenderScope, (parent) =>
    parent
      ? Effect.flatMap(Scope.fork(parent, ExecutionStrategy.sequential), (own) =>
          Effect.onExit(
            Effect.map(Effect.provideService(run, RenderScope, own), (n) => owned(n, own)),
            (exit) => (Exit.isSuccess(exit) ? Effect.void : Scope.close(own, exit)),
          ),
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
      return i < 0
        ? Effect.fail(e)
        : Effect.map(
            withHandlers(
              scopedRun(Effect.provideService(hs[i]!.fallback(e), Handlers, hs.slice(0, i))),
              hs.slice(0, i),
            ),
            asFallback,
          )
    },
  )
/** What a `Pending` body emitted, keyed by its output; `instance` copies it onto the node as `pending`. */
export const pendingOf = new WeakMap<Node, NonNullable<ReactiveNode['pending']>>()

const handled = (run: Effect.Effect<Node, any, any>): Effect.Effect<Node, any, any> =>
  Effect.flatMap(Handlers, (hs) => withHandlers(run, hs))

/** A scope that forks `parent` on first use. Used after it closed, it behaves like a closed scope: finalizers run at once. */
class LazyScope {
  readonly [Scope.ScopeTypeId] = Scope.ScopeTypeId
  readonly [Scope.CloseableScopeTypeId] = Scope.CloseableScopeTypeId
  readonly strategy = ExecutionStrategy.sequential
  private inner: Scope.CloseableScope | undefined
  private closed = false
  private lent = false

  constructor(
    private parent: Scope.Scope,
    private readonly lease: Scope.Scope | undefined,
    private readonly frame: RunFrame | undefined,
  ) {}

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

  /** Fork the mount's scope instead of the enclosing run's, so this scope outlives that run; only before first use. */
  lend(): void {
    if (this.lent || this.inner || !this.lease) return
    this.lent = true
    this.parent = this.lease
    if (this.frame) (this.frame.leased ??= []).push(this as unknown as Scope.CloseableScope)
  }

  /** Safe for a parent that skips its owner to keep: not closed, and either unused or independent of the enclosing run. */
  reusable(): boolean {
    return !this.closed && (!this.inner || this.lent)
  }

  private real(): Scope.CloseableScope {
    if (this.inner) return this.inner
    this.inner = Effect.runSync(Scope.fork(this.parent, ExecutionStrategy.sequential))
    if (this.closed) Effect.runSync(Scope.close(this.inner, Exit.void))
    return this.inner
  }
}

const lazyScope = (parent: Scope.Scope, lease?: Scope.Scope, frame?: RunFrame): LazyScope =>
  new LazyScope(parent, lease, frame)
/** Lends `scope` to the mount before its first use, when it is a lazy scope. */
export const lend = (scope: Scope.Scope | undefined): void => {
  if (scope instanceof LazyScope) scope.lend()
}
/** Closes `scope` without a fiber when it is a lazy scope nothing used; true when that handled it. */
export const closeIdle = (scope: Scope.CloseableScope): boolean =>
  (scope as unknown) instanceof LazyScope && (scope as unknown as LazyScope).closeIfIdle()
/** Closes a run scope now: without a fiber when it was never used. */
export const closeNow = (scope: Scope.CloseableScope): void => {
  if (!closeIdle(scope)) Effect.runFork(Scope.close(scope, Exit.void))
}

/** A host element a component returned as-is: `jsx` tags its Effect, so a run that returns one read no atom and used no scope. */
export interface HostDescriptor {
  readonly _ht: string
  readonly _hp: Record<string, unknown>
  readonly _hk: string | undefined
  /** The node `jsx` already built for an eligible host tree. */
  readonly _hn?: Node
}

export const hostOf = (e: unknown): HostDescriptor | undefined =>
  (e as HostDescriptor)._ht === undefined ? undefined : (e as HostDescriptor)
// Set by `jsx-runtime` (which imports this module): eligibility and the synchronous node build.
export const hostBuilder: {
  build?: (d: HostDescriptor, key: string | undefined) => Node | undefined
  same?: (a: HostDescriptor, b: HostDescriptor) => boolean
} = {}
const reusable = (scope: Scope.Scope | undefined): boolean => scope instanceof LazyScope && scope.reusable()

// Per-run services: rebuilt for every parent run, so they never decide whether a child's inputs changed.
const NO_ATOMS: ReadonlyArray<never> = []
const PER_RUN = new Set<string>([Collector.key, Frame.key, RenderScope.key])
const sameProps = (a: object, b: object): boolean => {
  if (a === b) return true
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  for (const k of ka)
    if (!Object.hasOwn(b, k) || !Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
      return false
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
export const instance = <P>(
  type: (props: P) => ComponentResult,
  props: P,
  key?: string,
): Effect.Effect<Node, any, any> => {
  // Fixed on the first run from the parent's frame; `rerun` reuses it and never bumps the parent's ordinals.
  let id: string | undefined
  // Slots of an instance with no parent frame (the root).
  let rootSlots: Slots | undefined
  // The props a run gives `type`: the call's own on the first run, with keyed handlers made stable; re-runs reuse them.
  let effProps: P = props
  // Set by the renderer's own re-run (an atom changed): the memo must not answer it.
  let forced = false
  const run: Effect.Effect<Node, any, any> = Effect.flatMap(Effect.context<never>(), (ctx) => {
    const first = id === undefined
    if (id === undefined) {
      if (key === undefined) {
        // Keyed calls take no ordinal: unkeyed siblings keep their ids when a keyed one comes or goes.
        const frame = Context.get(ctx, Frame)
        const ordinals = frame && (frame.ordinals ??= new Map())
        const ordinal = ordinals?.get(type) ?? 0
        ordinals?.set(type, ordinal + 1)
        id = `${fnId(type)}#${ordinal}`
      } else id = `${fnId(type)}:key:${key}`
    }
    const self = id
    // The component's own Effect, when the host fast path already called it.
    let pre: Effect.Effect<Node, any, any> | undefined
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
      // Unchanged props and services, and a scope that outlives the previous parent run: the last run's node stands (what it read
      // re-runs it by itself when that changes).
      const m = forced ? undefined : slots.memo
      forced = false
      if (
        m &&
        (m.scope === undefined || reusable(m.scope)) &&
        sameProps(m.props, effProps as object) &&
        sameServices(m.ctx, ctx)
      )
        return Effect.succeed(m.node)
      // A row that returns a plain host element builds its node here, without the run machinery; unchanged output reuses the last node.
      // Only an instance with no local state or child slots of its own: otherwise the normal run checks its slot count.
      if (hostBuilder.build && slots.atoms.length === 0 && slots.kids === undefined) {
        slots.running = true
        slots.called = false
        const eff = call(type, effProps)
        slots.running = false
        const d = hostOf(eff)
        if (d) {
          const pm = m
          if (pm?.host && hostBuilder.same!(pm.host, d) && !slots.called) {
            ;(pm as { props: object }).props = effProps as object
            return Effect.succeed(pm.node)
          }
          const built = hostBuilder.build(d, key)
          if (built) {
            slots.done = true
            // Keyed calls are always instance nodes (ADR 0015); an unkeyed one that read no atom is its plain output.
            const node: Node =
              key === undefined
                ? built
                : {
                    _tag: 'Reactive',
                    atoms: NO_ATOMS,
                    seen: NO_ATOMS,
                    child: built,
                    rerun: Effect.suspend(
                      () => ((forced = true), Effect.provide(handled(run), ctx)),
                    ) as Effect.Effect<Node>,
                    id: self,
                    key,
                  }
            slots.memo = slots.called
              ? undefined
              : {
                  props: effProps as object,
                  ctx,
                  node,
                  host: d,
                }
            return Effect.succeed(node)
          }
        }
        pre = eff
      }
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
      return Effect.flatMap(
        Effect.provide(((e) => ((pre = undefined), e))(pre ?? call(type, effProps)), inner),
        (child): Effect.Effect<Node, SlotMismatch> => {
          if (slots.done && frame.cursor !== slots.atoms.length)
            return Effect.fail(
              new SlotMismatch({
                id: self,
                expected: slots.atoms.length,
                actual: frame.cursor,
              }),
            )
          slots.done = true
          slots.running = false
          frame.leased = undefined
          const read = reads.size > 0
          // A run that read no atom and has no key is a plain subtree owned through its scope; anything else is an instance node.
          const plain = !read && key === undefined && !frame.effectful
          // A run that read no atom is never re-run by the renderer, so its `rerun` is built only if asked for.
          const node: Node = plain
            ? own
              ? owned(child, own)
              : child
            : {
                _tag: 'Reactive',
                atoms: read ? [...reads.keys()] : NO_ATOMS,
                seen: read ? [...reads.values()] : NO_ATOMS,
                child,
                scope: own,
                rerun: Effect.suspend(
                  () => ((forced = true), Effect.provide(handled(run), ctx)),
                ) as Effect.Effect<Node>,
                id: self,
                frame,
                ...(key !== undefined && { key }),
                ...(pendingOf.has(child) && { pending: pendingOf.get(child)! }),
              }
          // Remembered for the next parent run when the row's scope will still be there (unused, or lent to the mount) and it did not call a handler while rendering.
          slots.memo =
            parentFrame && own && !slots.called && reusable(own)
              ? {
                  props: effProps as object,
                  ctx,
                  node,
                  scope: own,
                }
              : undefined
          return Effect.succeed(node)
        },
      )
    }
    const parent = Context.get(ctx, RenderScope)
    if (!parent) return body(undefined)
    // The run's scope forks its parent only when something uses it (a Provider, a retained atom, ...); most rows never do.
    // A keyed run is always an instance node, so its scope is lent to the mount at once; any run that reads an atom lends it then.
    const lazy = lazyScope(parent, Context.get(ctx, MountScope), first ? parentFrame : undefined)
    if (key !== undefined) lazy.lend()
    const own = lazy as unknown as Scope.CloseableScope
    // A failed or interrupted run produces no node for the renderer to drop: its pending child slots and the scopes its children lent go here too.
    return Effect.onExit(body(own), (exit) =>
      Exit.isSuccess(exit)
        ? Effect.void
        : Effect.zipRight(
            Effect.sync(() => dropSlots(frame)),
            Scope.close(own, exit),
          ),
    )
  })
  return run
}
