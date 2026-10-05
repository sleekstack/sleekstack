/**
 * packages/core/src/atom/AtomStore.ts
 *
 * Holds atom state (effect-atom's Registry, modeled on internal/registry.ts). Writes push
 * invalidation (children marked "check"); reads pull the recompute, once per node, and a node
 * recomputes only when a dependency's version changed.
 */

import { Cause, Context, Effect, Equal, Exit, Fiber, Schema, Scope } from 'effect'
import { AtomCycle, DuplicateAtomKey } from '../errors'
import * as Result from './Result'
import type { Atom, BuildContext, Writable, WriteContext } from './Atom'

/** Options for {@link makeAtomStore}. */
export interface AtomStoreOptions {
  /** Context Effect and Stream atoms run with. Defaults to an empty Context. */
  readonly context?: Context.Context<any>
  /** Receives finalizer and scope-close failures. Defaults to `console.error`. */
  readonly onFinalizerError?: (error: unknown) => void
  /** Schedules idle-node removal. Defaults to `queueMicrotask`. */
  readonly scheduleTask?: (task: () => void) => void
  /** Idle time (ms) before an unused node is removed. Defaults to none (removed after one task). */
  readonly defaultIdleTTL?: number
  /** @internal Wraps every Effect/Stream build before it forks (used by `atomStoreFor`). */
  readonly wrapBuild?: (effect: Effect.Effect<any, any, any>, atom: Atom<any>) => Effect.Effect<any, any, any>
  /** Seeds serializable atoms from a snapshot at construction (see {@link hydrate}). */
  readonly hydrate?: Snapshot
  /** When true, Effect and Stream builds never start: unseeded result atoms stay `Initial`. */
  readonly inert?: boolean
}

/** Encoded values of serializable atoms by key; JSON-safe. */
export type Snapshot = Readonly<Record<string, unknown>>

const devWarn = (message: string) => {
  if ((globalThis as any).process?.env?.NODE_ENV !== 'production') console.warn(message)
}

/** Atom state container: one per scope. */
export interface AtomStore {
  /** Reads an atom's current value. */
  readonly get: <A>(atom: Atom<A>) => A
  /** Writes a writable atom. */
  readonly set: <R, W>(atom: Writable<R, W>, value: W) => void
  /** Writes `f(current)`. */
  readonly update: <R>(atom: Writable<R, R>, f: (value: R) => R) => void
  /** Calls `listener` when the atom's value changes; returns an unsubscribe function. */
  readonly subscribe: <A>(atom: Atom<A>, listener: () => void, options?: { readonly immediate?: boolean }) => () => void
  /** Keeps the atom built with a no-op subscription; returns the unmount function. */
  readonly mount: <A>(atom: Atom<A>) => () => void
  /** Holds the node (no subscription) until the returned release function runs. */
  readonly retain: <A>(atom: Atom<A>) => () => void
  /** Re-runs the atom, interrupting its in-flight build. */
  readonly refresh: <A>(atom: Atom<A>) => void
  /** Runs `f` and notifies subscribers once afterwards. */
  readonly batch: (f: () => void) => void
  /** Interrupts every build, runs every finalizer, and drops all nodes. */
  readonly dispose: () => Promise<void>
  /** @internal Read-only snapshot of the built atoms (devtools); never builds, reads or subscribes. Empty once disposed. */
  readonly inspect: () => ReadonlyArray<{ readonly atom: Atom<unknown>; readonly label: string; readonly value: unknown }>
  /** @internal Records seeds for serializable atoms; use {@link hydrate}. */
  readonly hydrate: (snapshot: Snapshot) => void
}

type State = 'uninit' | 'valid' | 'check' | 'dirty'

interface Node {
  readonly atom: Atom<any>
  state: State
  value: unknown
  version: number
  notified: number
  computing: boolean
  deps: Map<Node, number>
  readonly children: Set<Node>
  readonly listeners: Set<() => void>
  retains: number
  finalizers: Array<() => void>
  removalQueued: boolean
  bucket: Set<Node> | undefined
  /** The write context handed to `atom.write`, built on first write. */
  wctx?: WriteContext<any>
  /** In `pending` (a node is queued once per round). */
  queued?: boolean
}

const BUCKET_MS = 50

// `Equal.equals` negated, with the common primitive case answered without it (NaN still goes through `Equal`).
const differs = (a: unknown, b: unknown): boolean => {
  if (a === b) return false
  const t = typeof a
  return t === 'object' || t === 'function' || a !== a ? !Equal.equals(a, b) : true
}

/** Creates an {@link AtomStore}. */
export const makeAtomStore = (options: AtomStoreOptions = {}): AtomStore => {
  const context = options.context ?? Context.empty()
  const onFinalizerError = options.onFinalizerError ?? ((e: unknown) => console.error(e))
  const wrapBuild = options.wrapBuild ?? ((effect) => effect)
  const scheduleTask = options.scheduleTask ?? queueMicrotask
  const nodes = new Map<Atom<any>, Node>()
  let pending: Node[] = []
  const enqueue = (node: Node) => {
    if (node.queued) return
    node.queued = true
    pending.push(node)
  }
  const closing = new Set<Promise<void>>()
  const buckets = new Map<number, { nodes: Set<Node>; timer: ReturnType<typeof setTimeout> }>()
  const stack: Node[] = []
  let batchDepth = 0
  let disposed = false
  // seeds waiting for their atom's first read, and every key ever seeded (first seed wins)
  const seeds = new Map<string, unknown>()
  const seeded = new Set<string>()
  // serializable key -> the atom first built for it; kept past node eviction until dispose, so keys stay unique per store
  const keys = new Map<string, Atom<any>>()

  const ensure = (atom: Atom<any>): Node => {
    let node = nodes.get(atom)
    if (!node) {
      const key = atom.serializable?.key
      if (key !== undefined && keys.has(key) && keys.get(key) !== atom) {
        throw new DuplicateAtomKey({ key, message: `Two serializable atoms share the key "${key}"` })
      }
      node = {
        atom, state: 'uninit', value: undefined, version: 0, notified: 0, computing: false, deps: new Map(),
        children: new Set(), listeners: new Set(), retains: 0, finalizers: [], removalQueued: false, bucket: undefined,
      }
      nodes.set(atom, node)
      if (key !== undefined) keys.set(key, atom)
      scheduleRemoval(node)
    }
    return node
  }

  const runFinalizers = (node: Node) => {
    const fs = node.finalizers
    node.finalizers = []
    for (let i = fs.length - 1; i >= 0; i--) {
      try { fs[i]!() } catch (e) { onFinalizerError(e) }
    }
  }

  // visited per traversal: a node left 'check'/'dirty' by a failed pull still forwards to its descendants
  const markChildren = (node: Node, visited?: Set<Node>) => {
    if (node.children.size === 0) return
    visited ??= new Set<Node>()
    for (const child of node.children) {
      if (visited.has(child)) continue
      visited.add(child)
      enqueue(child)
      if (child.state === 'valid') child.state = 'check'
      markChildren(child, visited)
    }
  }

  const flush = () => {
    if (batchDepth > 0) return
    while (pending.length > 0) {
      const batch = pending
      pending = []
      for (const node of batch) node.queued = false
      for (const node of batch) {
        // nodes holding a build (fibers, finalizers) are pulled too, so invalidation interrupts them
        if ((node.listeners.size === 0 && node.finalizers.length === 0) || nodes.get(node.atom) !== node) continue
        try { pull(node) } catch { /* listeners re-read and see the error */ }
        if (node.version === node.notified && node.state === 'valid') continue
        node.notified = node.version
        for (const l of [...node.listeners]) l()
      }
    }
  }

  const invalidate = (node: Node) => {
    node.state = 'dirty'
    runFinalizers(node)
    enqueue(node)
    markChildren(node)
    flush()
  }

  const setValue = (node: Node, value: unknown) => {
    const changed = node.state === 'uninit' || differs(node.value, value)
    node.state = 'valid' // an explicit write supersedes a pending recompute
    if (!changed) return
    node.value = value
    node.version++
    // `flush` only pulls a node something listens to or built a resource for.
    if (node.listeners.size > 0 || node.finalizers.length > 0) enqueue(node)
    markChildren(node)
    flush()
  }

  const buildContext = (node: Node): BuildContext => {
    const get = <A>(atom: Atom<A>): A => {
      const parent = ensure(atom)
      if (parent.computing) {
        const path = [...stack.slice(stack.indexOf(parent)), parent].map((n) => n.atom.label)
        throw new AtomCycle({ path, message: `Atom read cycle: ${path.join(' -> ')}` })
      }
      // edge first, so a read that throws still re-runs this node when the parent recovers
      node.deps.set(parent, parent.version)
      parent.children.add(node)
      cancelRemoval(parent)
      pull(parent)
      node.deps.set(parent, parent.version)
      return parent.value as A
    }
    return Object.assign(get, {
      get,
      self: <A>() => (node.state === 'uninit' ? undefined : (node.value as A)),
      setSelf: (value: unknown) => setValue(node, value),
      refresh: (atom: Atom<any>) => refresh(atom),
      refreshSelf: () => invalidate(node),
      addFinalizer: (f: () => void) => { node.finalizers.push(f) },
      fork: <A, E>(effect: Effect.Effect<A, E, any>, onExit: (exit: Exit.Exit<A, E>) => void) => {
        if (options.inert) return undefined
        const scope = Effect.runSync(Scope.make())
        const fiber = Effect.runFork(wrapBuild(effect, node.atom).pipe(Scope.extend(scope), Effect.provide(context)) as Effect.Effect<A, E>)
        let active = true
        node.finalizers.push(() => {
          active = false
          const running = fiber.unsafePoll() === null
          const report = (exit: Exit.Exit<unknown, unknown>) => {
            if (Exit.isFailure(exit) && !Cause.isInterruptedOnly(exit.cause)) onFinalizerError(Cause.squash(exit.cause))
          }
          const done: Promise<void> = Effect.runPromise(
            Fiber.interrupt(fiber).pipe(
              Effect.tap((exit) => Effect.sync(() => { if (running) report(exit) })),
              Effect.zipRight(Effect.exit(Scope.close(scope, Exit.void))),
              Effect.tap((exit) => Effect.sync(() => report(exit))),
            ),
          ).then(() => {})
            .finally(() => closing.delete(done))
          closing.add(done)
        })
        const exit = fiber.unsafePoll()
        if (exit) return exit
        fiber.addObserver((exit) => { if (active) onExit(exit) })
        return undefined
      },
    })
  }

  const recompute = (node: Node) => {
    runFinalizers(node)
    // Edges are diffed after the read: a parent read again keeps its edge, so it is never scheduled for removal.
    const previous = node.deps
    node.deps = new Map()
    node.computing = true
    stack.push(node)
    let value: unknown
    try {
      value = node.atom.read(buildContext(node))
    } finally {
      node.computing = false
      stack.pop()
      for (const parent of previous.keys()) if (!node.deps.has(parent)) { parent.children.delete(node); scheduleRemoval(parent) }
    }
    if (node.state === 'uninit' || differs(node.value, value)) { node.value = value; node.version++ }
    node.state = 'valid'
  }

  // first read of a seeded atom: the decoded seed replaces `read`, so no build runs
  const applySeed = (node: Node): boolean => {
    const info = node.atom.serializable
    if (node.state !== 'uninit' || !info || !seeds.has(info.key)) return false
    const raw = seeds.get(info.key)
    seeds.delete(info.key)
    let decoded: unknown
    try {
      decoded = Schema.decodeUnknownSync(info.schema)(raw)
    } catch (e) {
      devWarn(`[sleekstack] dropped the seed for atom key "${info.key}": ${String(e)}`)
      return false
    }
    node.value = info.kind === 'result' ? Result.success(decoded) : decoded
    node.version++
    node.state = 'valid'
    return true
  }

  const pull = (node: Node) => {
    if (node.state === 'valid' || applySeed(node)) return
    if (node.state === 'check') {
      for (const [parent, version] of node.deps) {
        pull(parent)
        if (parent.version !== version) { node.state = 'dirty'; break }
      }
      if (node.state === 'check') { node.state = 'valid'; return }
    }
    recompute(node)
  }

  const removable = (node: Node) =>
    !node.atom.keepAlive && node.listeners.size === 0 && node.children.size === 0 && node.retains === 0

  const remove = (node: Node) => {
    if (nodes.get(node.atom) !== node) return
    nodes.delete(node.atom)
    runFinalizers(node)
    for (const parent of node.deps.keys()) { parent.children.delete(node); scheduleRemoval(parent) }
  }

  const cancelRemoval = (node: Node) => {
    node.bucket?.delete(node)
    node.bucket = undefined
  }

  function scheduleRemoval(node: Node) {
    if (!removable(node)) return
    const ttl = node.atom.idleTTL ?? options.defaultIdleTTL
    if (ttl === undefined || ttl <= 0) {
      if (node.removalQueued) return
      node.removalQueued = true
      scheduleTask(() => { node.removalQueued = false; if (removable(node)) remove(node) })
      return
    }
    cancelRemoval(node)
    const at = Math.ceil((Date.now() + ttl) / BUCKET_MS) * BUCKET_MS
    let bucket = buckets.get(at)
    if (!bucket) {
      const created = {
        nodes: new Set<Node>(),
        timer: setTimeout(() => {
          buckets.delete(at)
          for (const n of created.nodes) { n.bucket = undefined; if (removable(n)) remove(n) }
        }, at - Date.now()),
      }
      bucket = created
      buckets.set(at, bucket)
    }
    bucket.nodes.add(node)
    node.bucket = bucket.nodes
  }

  const get = <A>(atom: Atom<A>): A => {
    const node = ensure(atom)
    pull(node)
    return node.value as A
  }

  const writeContext = <R>(node: Node): WriteContext<R> => ({
    get,
    set: (atom, value) => set(atom, value),
    setSelf: (value) => setValue(node, value),
    refreshSelf: () => invalidate(node),
  })

  const set = <R, W>(atom: Writable<R, W>, value: W) => {
    const node = ensure(atom)
    try { pull(node) } catch { /* the write may replace a failing value */ }
    const ctx = (node.wctx ??= writeContext<R>(node)) as WriteContext<R>
    batchDepth++
    try { atom.write(ctx, value) } finally { batchDepth--; flush() }
  }

  const subscribe = <A>(atom: Atom<A>, listener: () => void, opts?: { readonly immediate?: boolean }) => {
    const node = ensure(atom)
    const l = () => listener()
    node.listeners.add(l)
    cancelRemoval(node)
    try { pull(node) } catch { /* surfaced on read */ }
    node.notified = node.version
    if (opts?.immediate) l()
    return () => { node.listeners.delete(l); scheduleRemoval(node) }
  }

  const refresh = <A>(atom: Atom<A>) => {
    const node = nodes.get(atom)
    if (node) invalidate(node)
  }

  const batch = (f: () => void) => {
    batchDepth++
    try { f() } finally { batchDepth--; flush() }
  }

  const hydrateStore = (snapshot: Snapshot) => {
    if (disposed) return
    let entries: Array<[string, unknown]>
    try {
      const proto = typeof snapshot === 'object' && snapshot !== null ? Object.getPrototypeOf(snapshot) : undefined
      if (proto !== Object.prototype && proto !== null) throw new Error('not a plain object')
      entries = Object.entries(snapshot)
    } catch {
      devWarn('[sleekstack] hydrate ignored a snapshot that is not a plain object')
      return
    }
    for (const [key, raw] of entries) {
      // any node already created for the key keeps its own value
      if (seeded.has(key) || keys.has(key)) continue
      seeded.add(key)
      seeds.set(key, raw)
    }
  }

  const store: AtomStore = {
    get,
    set,
    update: (atom, f) => set(atom, f(get(atom))),
    subscribe,
    mount: (atom) => subscribe(atom, () => {}),
    retain: (atom) => {
      const node = ensure(atom)
      node.retains++
      cancelRemoval(node)
      let released = false
      return () => {
        if (released) return
        released = true
        node.retains--
        scheduleRemoval(node)
      }
    },
    refresh,
    batch,
    inspect: () => disposed ? [] : [...nodes.values()].filter((n) => n.state !== 'uninit').map((n) => ({ atom: n.atom, label: n.atom.label, value: n.value })),
    hydrate: hydrateStore,
    dispose: async () => {
      disposed = true
      keys.clear()
      seeds.clear()
      for (const { timer } of buckets.values()) clearTimeout(timer)
      buckets.clear()
      for (const node of [...nodes.values()]) { nodes.delete(node.atom); runFinalizers(node) }
      await Promise.all([...closing])
    },
  }
  if (options.hydrate !== undefined) hydrateStore(options.hydrate)
  return store
}

/**
 * Seeds `store` from `snapshot`: each entry is decoded at its atom's first read, which then
 * skips `read`. Unknown keys are ignored, the first seed per key wins, built nodes are never
 * overwritten, and a failed decode is dropped with a dev warning. Never throws.
 */
export const hydrate = (store: AtomStore, snapshot: Snapshot): void => store.hydrate(snapshot)

/**
 * Encodes every built serializable atom: value kind always, result kind only on `Success`.
 * A value failing its `Schema` encode is skipped with a dev warning. A disposed store gives `{}`.
 */
export const dehydrate = (store: AtomStore): Snapshot => {
  const out: Record<string, unknown> = Object.create(null) // a `__proto__` key stays an own entry
  for (const { atom, value } of store.inspect()) {
    const info = atom.serializable
    if (!info) continue
    if (info.kind === 'result' && !Result.isSuccess(value as Result.Result<unknown, unknown>)) continue
    const plain = info.kind === 'result' ? (value as Result.Success<unknown>).value : value
    try {
      out[info.key] = Schema.encodeSync(info.schema)(plain)
    } catch (e) {
      devWarn(`[sleekstack] dehydrate skipped atom key "${info.key}": ${String(e)}`)
    }
  }
  return out
}
