/**
 * packages/react/src/atoms.ts
 *
 * Atom hooks (modeled on @effect-atom/atom-react) against the nearest LayerProvider's AtomStore.
 * Hooks suspend on the provider's scope promise until its store exists. Client only.
 */

import { useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react'
import { Cause, Data } from 'effect'
import { Atom, Result, type AtomStore } from '@sleekstack/core'
import { ProviderContext } from './context'

/** Error code `AtomsClientOnly`: an atom hook ran during a server render. Atoms are client only. */
export class AtomsClientOnly extends Data.TaggedError('AtomsClientOnly')<{ readonly message: string }> {}

function useStore(hook: string): AtomStore {
  if (typeof window === 'undefined') {
    throw new AtomsClientOnly({ message: `${hook} ran during a server render; atoms are client only. Render the component on the client only.` })
  }
  const state = useContext(ProviderContext)
  if (state === null) {
    throw new Error(`${hook} needs a <LayerProvider> above this component: atom state lives in the nearest provider.`)
  }
  if (state.atoms) return state.atoms
  if (state.scopeState.status === 'rejected') throw state.scopeState.error
  state.start()
  throw state.scope
}

interface Binding {
  readonly subscribe: (listener: () => void) => () => void
  readonly getSnapshot: () => unknown
}
const bindings = new WeakMap<AtomStore, WeakMap<Atom.Atom<any>, Binding>>()

const bindingFor = (store: AtomStore, atom: Atom.Atom<any>): Binding => {
  let perStore = bindings.get(store)
  if (!perStore) bindings.set(store, (perStore = new WeakMap()))
  let b = perStore.get(atom)
  if (!b) perStore.set(atom, (b = { subscribe: (l) => store.subscribe(atom, l), getSnapshot: () => store.get(atom) }))
  return b
}

const NONE = Symbol()
// React throttles Suspense reveals (~300 ms), so the retry can commit that long after the load settles.
const RETRY_MS = 400

function useValue<A>(store: AtomStore, atom: Atom.Atom<A>): A {
  const b = bindingFor(store, atom)
  return useSyncExternalStore(b.subscribe, b.getSnapshot) as A
}

/**
 * Reads an atom from the nearest {@link LayerProvider} and re-renders when its value changes.
 *
 * @param atom - The atom to read.
 * @returns The atom's value.
 * @throws `AtomsClientOnly` during a server render; `Error` outside a `LayerProvider`.
 *
 * @example
 * ```tsx
 * import { Atom } from '@sleekstack/core'
 * import { useAtomValue } from '@sleekstack/react'
 *
 * const count = Atom.make(0)
 * const Count = () => <span>{useAtomValue(count)}</span>
 * ```
 */
export function useAtomValue<A>(atom: Atom.Atom<A>): A
/**
 * Reads `f` of an atom's value; the component re-renders only when the mapped value changes.
 *
 * @param atom - The atom to read.
 * @param f - The mapping.
 * @returns `f` of the atom's value.
 * @throws `AtomsClientOnly` during a server render; `Error` outside a `LayerProvider`.
 */
export function useAtomValue<A, B>(atom: Atom.Atom<A>, f: (a: A) => B): B
export function useAtomValue<A, B>(atom: Atom.Atom<A>, f?: (a: A) => B): A | B {
  const store = useStore('useAtomValue')
  const b = bindingFor(store, atom)
  // Maps outside the atom graph (so a selected Effect/Stream stays a value); re-maps only when the input changes.
  const getSnapshot = useMemo(() => {
    if (!f) return b.getSnapshot
    let input: unknown = NONE
    let output: B
    return () => {
      const value = b.getSnapshot()
      if (!Object.is(value, input)) { input = value; output = f(value as A) }
      return output
    }
  }, [b, f])
  return useSyncExternalStore(b.subscribe, getSnapshot) as A | B
}

function useMounted(store: AtomStore, atom: Atom.Atom<any>) {
  useEffect(() => store.mount(atom), [store, atom])
}

/**
 * Returns a setter for a writable atom, keeping the atom mounted while the component is.
 *
 * @param atom - The writable atom.
 * @returns `(value) => void`.
 * @throws `AtomsClientOnly` during a server render; `Error` outside a `LayerProvider`.
 *
 * @example
 * ```tsx
 * const count = Atom.make(0)
 * const Reset = () => { const set = useAtomSet(count); return <button onClick={() => set(0)}>reset</button> }
 * ```
 */
export function useAtomSet<R, W>(atom: Atom.Writable<R, W>): (value: W) => void {
  const store = useStore('useAtomSet')
  useMounted(store, atom)
  return useCallback((value: W) => store.set(atom, value), [store, atom])
}

/**
 * Reads and writes an atom: `[value, set]`.
 *
 * @param atom - The writable atom.
 * @returns The value and its setter.
 * @throws `AtomsClientOnly` during a server render; `Error` outside a `LayerProvider`.
 *
 * @example
 * ```tsx
 * const count = Atom.make(0)
 * const Inc = () => { const [n, set] = useAtom(count); return <button onClick={() => set(n + 1)}>{n}</button> }
 * ```
 */
export function useAtom<R, W>(atom: Atom.Writable<R, W>): readonly [R, (value: W) => void] {
  const store = useStore('useAtom')
  const value = useValue(store, atom)
  const set = useCallback((v: W) => store.set(atom, v), [store, atom])
  return [value, set] as const
}

/**
 * Returns a function that re-runs the atom (interrupting an in-flight build).
 *
 * @param atom - The atom to refresh.
 * @returns `() => void`.
 * @throws `AtomsClientOnly` during a server render; `Error` outside a `LayerProvider`.
 *
 * @example
 * ```tsx
 * const Reload = ({ user }: { user: Atom.Atom<unknown> }) => <button onClick={useAtomRefresh(user)}>reload</button>
 * ```
 */
export function useAtomRefresh(atom: Atom.Atom<any>): () => void {
  const store = useStore('useAtomRefresh')
  useMounted(store, atom)
  return useCallback(() => store.refresh(atom), [store, atom])
}

const pending = (r: Result.Result<any, any>, onWaiting: boolean) => r._tag === 'Initial' || (onWaiting && r.waiting)

const once = (f: () => void) => { let done = false; return () => { if (!done) { done = true; f() } } }
const closed = new WeakSet<AtomStore>()
/** The store's scope closed (its nodes are gone): stop the suspension GC timers waiting on it. */
export const settleSuspensions = (store: AtomStore) => void closed.add(store)

// A settled suspension's hold on its node. `blockers` counts later suspensions started inside its retry window
// (the same render chain retrying into its next atom, i.e. a waterfall): it stays held until they finish.
interface Hold { blockers: number; readonly finish: () => void }
// Settled holds re-read (still resolved) by the render in progress: a waterfall's retry reads its earlier atoms
// before suspending on the next one, so these are the only predecessors a new suspension links to. Cleared on a
// microtask, i.e. per synchronous render pass.
const touched = new WeakMap<AtomStore, Set<Hold>>()
const touch = (store: AtomStore, hs: Iterable<Hold>) => {
  let set = touched.get(store)
  if (!set) {
    touched.set(store, (set = new Set()))
    queueMicrotask(() => touched.delete(store))
  }
  for (const h of hs) set.add(h)
}
// Settled holds awaiting a committed reader.
const holds = new WeakMap<AtomStore, WeakMap<Atom.Atom<any>, Set<Hold>>>()
const holdsFor = (store: AtomStore, atom: Atom.Atom<any>) => {
  let perStore = holds.get(store)
  if (!perStore) holds.set(store, (perStore = new WeakMap()))
  let set = perStore.get(atom)
  if (!set) perStore.set(atom, (set = new Set()))
  return set
}

// One promise per (store, atom, suspendOnWaiting) until it settles; the next suspension is a new generation.
const suspensions = new WeakMap<AtomStore, WeakMap<Atom.Atom<any>, Map<boolean, Promise<void>>>>()

const suspensionFor = (store: AtomStore, atom: Atom.Atom<Result.Result<any, any>>, onWaiting: boolean): Promise<void> => {
  let perStore = suspensions.get(store)
  if (!perStore) suspensions.set(store, (perStore = new WeakMap()))
  let perAtom = perStore.get(atom)
  if (!perAtom) perStore.set(atom, (perAtom = new Map()))
  const found = perAtom.get(onWaiting)
  if (found) return found
  const promise = new Promise<void>((resolve) => {
    // Holds the node past settle until a reader commits (its subscription takes over, see useAtomSuspense) or
    // the render is abandoned: RETRY_MS after settling with no later suspension of its chain still held.
    // ponytail: "chain" = suspensions raised in the same synchronous render pass that re-read the held atom; an
    // unrelated boundary rendering in that same pass after such a read would also link. Per-owner identity if that matters.
    const retained = store.retain(atom)
    const preds = [...(touched.get(store) ?? [])]
    for (const p of preds) p.blockers++
    const hold: Hold = {
      blockers: 0,
      finish: once(() => {
        holdsFor(store, atom).delete(hold)
        retained()
        for (const p of preds) p.blockers--
      }),
    }
    let unsubscribe: (() => void) | undefined
    let done = false
    const check = () => {
      if (done) return
      let r: Result.Result<any, any>
      try { r = store.get(atom) } catch { r = Result.success(undefined) } // a throwing read settles too; the retry rethrows it
      if (pending(r, onWaiting)) return
      done = true
      perAtom!.delete(onWaiting)
      unsubscribe?.()
      holdsFor(store, atom).add(hold)
      const gc = (): unknown => setTimeout(() => {
        if (closed.has(store)) return
        if (hold.blockers > 0) return gc()
        hold.finish()
      }, RETRY_MS)
      gc()
      resolve()
    }
    unsubscribe = store.subscribe(atom, check)
    if (done) unsubscribe()
    else check()
  })
  perAtom.set(onWaiting, promise)
  return promise
}

/**
 * Reads an Effect/Stream atom, suspending while it is `Initial` (or refreshing, with `suspendOnWaiting`).
 *
 * @param atom - An atom whose value is a `Result`.
 * @param options - `suspendOnWaiting`: also suspend while a refresh runs.
 * @returns The `Success` result.
 * @throws `Cause.squash` of a `Failure`'s Cause, to the nearest error boundary.
 * @throws `AtomsClientOnly` during a server render; `Error` outside a `LayerProvider`.
 *
 * @example
 * ```tsx
 * const user = Atom.make(Effect.succeed({ name: 'Ada' }))
 * const Name = () => <span>{useAtomSuspense(user).value.name}</span>
 * ```
 */
export function useAtomSuspense<A, E>(
  atom: Atom.Atom<Result.Result<A, E>>,
  options?: { readonly suspendOnWaiting?: boolean },
): Result.Success<A, E> {
  const store = useStore('useAtomSuspense')
  const result = useValue(store, atom)
  // Committed: this component's subscription holds the node now, so drop the suspension holds.
  useEffect(() => {
    for (const hold of [...holdsFor(store, atom)]) hold.finish()
  }, [store, atom])
  const onWaiting = options?.suspendOnWaiting ?? false
  if (pending(result, onWaiting)) throw suspensionFor(store, atom, onWaiting)
  touch(store, holdsFor(store, atom))
  if (result._tag === 'Failure') throw Cause.squash(result.cause)
  return result as Result.Success<A, E>
}
