/**
 * packages/core/src/atom/AtomStore.ts
 *
 * Holds atom state (effect-atom's Registry, modeled on internal/registry.ts). Writes push
 * invalidation (children marked "check"); reads pull the recompute, once per node, and a node
 * recomputes only when a dependency's version changed.
 */

import { Cause, Context, Effect, Equal, Exit, Fiber, Scope } from 'effect'
import { AtomCycle } from '../errors'
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
}

const BUCKET_MS = 50

/** Creates an {@link AtomStore}. */
export const makeAtomStore = (options: AtomStoreOptions = {}): AtomStore => {
  const context = options.context ?? Context.empty()
  const onFinalizerError = options.onFinalizerError ?? ((e: unknown) => console.error(e))
  const scheduleTask = options.scheduleTask ?? queueMicrotask
  const nodes = new Map<Atom<any>, Node>()
  const pending = new Set<Node>()
  const closing = new Set<Promise<void>>()
  const buckets = new Map<number, { nodes: Set<Node>; timer: ReturnType<typeof setTimeout> }>()
  const stack: Node[] = []
  let batchDepth = 0

  const ensure = (atom: Atom<any>): Node => {
    let node = nodes.get(atom)
    if (!node) {
      node = {
        atom, state: 'uninit', value: undefined, version: 0, notified: 0, computing: false, deps: new Map(),
        children: new Set(), listeners: new Set(), retains: 0, finalizers: [], removalQueued: false, bucket: undefined,
      }
      nodes.set(atom, node)
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
  const markChildren = (node: Node, visited = new Set<Node>()) => {
    for (const child of node.children) {
      if (visited.has(child)) continue
      visited.add(child)
      pending.add(child)
      if (child.state === 'valid') child.state = 'check'
      markChildren(child, visited)
    }
  }

  const flush = () => {
    if (batchDepth > 0) return
    while (pending.size > 0) {
      const batch = [...pending]
      pending.clear()
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
    pending.add(node)
    markChildren(node)
    flush()
  }

  const setValue = (node: Node, value: unknown) => {
    const changed = node.state === 'uninit' || !Equal.equals(node.value, value)
    node.state = 'valid' // an explicit write supersedes a pending recompute
    if (!changed) return
    node.value = value
    node.version++
    pending.add(node)
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
        const scope = Effect.runSync(Scope.make())
        const fiber = Effect.runFork(effect.pipe(Scope.extend(scope), Effect.provide(context)) as Effect.Effect<A, E>)
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
    for (const parent of node.deps.keys()) { parent.children.delete(node); scheduleRemoval(parent) }
    node.deps = new Map()
    node.computing = true
    stack.push(node)
    let value: unknown
    try {
      value = node.atom.read(buildContext(node))
    } finally {
      node.computing = false
      stack.pop()
    }
    if (node.state === 'uninit' || !Equal.equals(node.value, value)) { node.value = value; node.version++ }
    node.state = 'valid'
  }

  const pull = (node: Node) => {
    if (node.state === 'valid') return
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
    batch(() => atom.write(writeContext<R>(node), value))
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

  return {
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
    dispose: async () => {
      for (const { timer } of buckets.values()) clearTimeout(timer)
      buckets.clear()
      for (const node of [...nodes.values()]) { nodes.delete(node.atom); runFinalizers(node) }
      await Promise.all([...closing])
    },
  }
}
