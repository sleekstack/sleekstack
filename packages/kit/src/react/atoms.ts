/**
 * packages/kit/src/react/atoms.ts
 *
 * Kit atom hooks over the react package's. Async atoms suspend until their first value;
 * failures reach boundaries as SleekStackError.
 */

import { useAtomSet as coreUseAtomSet, useAtomSuspense } from '@sleekstack/react'
import { normalize } from '../errors'
import { coreAtom, type Atom, type WritableAtom } from '../atom'

const isThenable = (x: unknown) => typeof (x as { then?: unknown } | null)?.then === 'function'

const kit = <T>(f: () => T): T => {
  try {
    return f()
  } catch (e) {
    if (isThenable(e)) throw e
    throw normalize(e)
  }
}

/** A value, or an updater from the previous value. */
export type SetAtom<T> = (value: T | ((prev: T) => T)) => void

/**
 * Reads an atom from the nearest `LayerProvider` and re-renders when it changes. Suspends until a derived
 * atom's first value is ready; wrap in `<Suspense>`.
 *
 * @param atom - The atom to read.
 * @returns Its value.
 * @throws {@link SleekStackError} with code `MissingDependency` when a dep is not provided,
 *   `AtomCycle` when atoms read each other in a cycle, and `Unknown` when `fn` throws or rejects, outside a
 *   `LayerProvider`, or during a server render.
 *
 * @example
 * ```tsx
 * import { atom } from '@sleekstack/kit'
 * import { useAtomValue } from '@sleekstack/kit/react'
 *
 * const count = atom(0)
 * export const Count = () => <span>{useAtomValue(count)}</span>
 * ```
 */
export function useAtomValue<T>(atom: Atom<T>): T {
  return kit(() => useAtomSuspense(coreAtom(atom)).value as T)
}

/**
 * A setter for a writable atom; accepts a value or an updater.
 *
 * @param atom - An atom created from a value.
 * @returns The setter.
 * @throws {@link SleekStackError} with code `Unknown` outside a `LayerProvider` or during a server render.
 *
 * @example
 * ```tsx
 * import { atom } from '@sleekstack/kit'
 * import { useAtomSet } from '@sleekstack/kit/react'
 *
 * const count = atom(0)
 * export const Inc = () => { const set = useAtomSet(count); return <button onClick={() => set((n) => n + 1)}>+</button> }
 * ```
 */
export function useAtomSet<T>(atom: WritableAtom<T>): SetAtom<T> {
  return kit(() => coreUseAtomSet(coreAtom(atom) as never) as SetAtom<T>)
}

/**
 * `[useAtomValue(atom), useAtomSet(atom)]`.
 *
 * @param atom - An atom created from a value.
 * @returns The value and its setter.
 * @throws {@link SleekStackError} with the same codes as {@link useAtomValue}.
 *
 * @example
 * ```tsx
 * import { atom } from '@sleekstack/kit'
 * import { useAtom } from '@sleekstack/kit/react'
 *
 * const count = atom(0)
 * export const Counter = () => { const [n, set] = useAtom(count); return <button onClick={() => set(n + 1)}>{n}</button> }
 * ```
 */
export function useAtom<T>(atom: WritableAtom<T>): readonly [T, SetAtom<T>] {
  return [useAtomValue(atom), useAtomSet(atom)] as const
}
