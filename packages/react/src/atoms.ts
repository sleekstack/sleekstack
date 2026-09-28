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

function useValue<A>(store: AtomStore, atom: Atom.Atom<A>): A {
  const b = bindingFor(store, atom)
  return useSyncExternalStore(b.subscribe, b.getSnapshot) as A
}

/**
 * Reads an atom from the nearest {@link LayerProvider} and re-renders when its value changes.
 *
 * @param atom - The atom to read.
 * @param f - Optional mapping; the component re-renders only when the mapped value changes.
 * @returns The atom's value (or `f` of it).
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
export function useAtomValue<A, B>(atom: Atom.Atom<A>, f: (a: A) => B): B
export function useAtomValue<A, B>(atom: Atom.Atom<A>, f?: (a: A) => B): A | B {
  const store = useStore('useAtomValue')
  const mapped = useMemo(() => (f ? Atom.make((get) => f(get(atom))) : atom), [atom, f])
  return useValue(store, mapped as Atom.Atom<A | B>)
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
    // Holds the node until the load settles, then for idleTTL (via release) so the retry render can subscribe.
    const release = store.retain(atom)
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
      release()
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
  const onWaiting = options?.suspendOnWaiting ?? false
  if (pending(result, onWaiting)) throw suspensionFor(store, atom, onWaiting)
  if (result._tag === 'Failure') throw Cause.squash(result.cause)
  return result as Result.Success<A, E>
}
