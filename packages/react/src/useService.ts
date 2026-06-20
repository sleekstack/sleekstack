/**
 * packages/react/src/useService.ts
 *
 * useService hook — resolves a service from the nearest LayerProvider via Suspense.
 *
 * Three-state cache protocol (in order):
 *   1. value present  → return synchronously (sync fast-path, REACT-03)
 *   2. error present  → throw error (error boundary, D-06; checked BEFORE promise — Pitfall 3)
 *   3. promise present → throw promise (in-flight Suspense, REACT-04)
 *   4. cache miss     → start acquisition, cache promise, throw promise (first-time Suspense)
 *
 * Security: error messages name the service Tag by identifier only; no internal Effect
 * stack traces or runtime internals are included (T-03-01, 01-RESEARCH.md Security Domain).
 *
 * @example
 * ```tsx
 * // IMPORTANT: wrap the component in a <Suspense> boundary — useService will throw
 * // a Promise on first acquisition (React Suspense protocol).
 * //
 * // <Suspense fallback={<Loading />}>
 * //   <MyComponent />
 * // </Suspense>
 *
 * function MyComponent() {
 *   const myService = useService(MyServiceTag)
 *   return <div>{myService.greet()}</div>
 * }
 * ```
 */

import { useContext } from 'react'
import type { Context } from 'effect'
import { ProviderContext } from './context'

/**
 * Resolve a service from the nearest ancestor LayerProvider.
 *
 * On first call, suspends the component (throws a Promise) while the Layer acquires
 * the service. After resolution, returns the service synchronously from cache on every
 * subsequent render — no re-suspension (REACT-03).
 *
 * Wrap the calling component in a `<Suspense>` boundary. LayerProvider does NOT
 * auto-wrap children with Suspense (D-01).
 *
 * @param tag - The Effect Context.Tag identifying the service to resolve.
 * @returns The resolved service instance (type T).
 *
 * @throws {Error} if no ancestor LayerProvider exists — message names the service and
 *   instructs adding a LayerProvider above the component (REACT-06).
 * @throws {Promise} on first call while acquiring (Suspense protocol, REACT-04).
 * @throws {unknown} if the Layer's Effect fails during acquisition (caught by ErrorBoundary, D-06).
 */
export function useService<T>(tag: Context.Tag<any, T>): T {
  const state = useContext(ProviderContext)

  if (state === null) {
    // Derive a readable service name from the Tag — identifier only, no stack details (T-03-01).
    const tagName: string =
      (tag as any)._tag ??
      (tag as any).key ??
      (tag as any).identifier ??
      String(tag)

    throw new Error(
      `Service '${tagName}' is not provided. ` +
      `Add a Layer for ${tagName} to a <LayerProvider> above this component.`
    )
  }

  // Three-state discriminated cache check (CR-03) — ORDER IS CRITICAL (see RESEARCH.md Pitfall 3):
  //   resolved first (sync fast-path), then rejected (before pending!), then pending (in-flight).
  //
  // Using status discriminant instead of `!== undefined` guards prevents an infinite Suspense
  // loop when a service resolves to `undefined` or defects with `undefined` (CR-03).
  const cached = state.cache.get(tag)

  if (cached !== undefined) {
    // 1. Sync fast-path — service already resolved (REACT-03)
    if (cached.status === 'resolved') return cached.value as T

    // 2. Error path — Layer acquisition failed; throw to nearest ErrorBoundary (D-06).
    //    MUST be checked before pending to prevent re-suspending on a rejected entry (Pitfall 3).
    if (cached.status === 'rejected') throw cached.error

    // 3. In-flight Suspense — acquisition started, suspend while waiting (REACT-04)
    if (cached.status === 'pending') throw cached.promise
  }

  // 4. Cache miss — start acquisition via ManagedRuntime
  const promise = state.runtime
    .runPromise(tag as any)
    .then((val: unknown) => {
      state.cache.set(tag, { status: 'resolved', value: val })
    })
    .catch((err: unknown) => {
      state.cache.set(tag, { status: 'rejected', error: err })
    })

  // Store pending entry — then/catch handlers will transition to resolved/rejected
  state.cache.set(tag, { status: 'pending', promise })

  // First-time Suspense throw (REACT-04)
  throw promise
}
