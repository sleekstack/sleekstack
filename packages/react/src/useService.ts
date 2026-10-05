/**
 * packages/react/src/useService.ts
 *
 * Resolves a service from the nearest LayerProvider's component scope. Suspends
 * while the scope is being built, then returns synchronously (including
 * `undefined`-valued services). Failures throw to the nearest error boundary.
 * Wrap consumers in `<Suspense>`; LayerProvider does not add one.
 */

import { useContext } from 'react'
import { Context } from 'effect'
import { resolveTag, type ChildScope } from '@sleekstack/core'
import { ProviderContext, type CacheEntry, type ProviderState } from './context'

const tagName = (tag: Context.Tag<any, any>): string => (tag as { key?: string }).key ?? String(tag)

const lookup = (scope: ChildScope, tag: Context.Tag<any, any>): unknown => resolveTag(scope.context, tag, 'useService')

function entryFor(state: ProviderState, tag: Context.Tag<any, any>): CacheEntry {
  const cached = state.cache.get(tag)
  if (cached) return cached
  const s = state.scopeState
  let entry: CacheEntry
  if (s.status === 'rejected') {
    entry = { status: 'rejected', error: s.error, promise: Promise.resolve() }
  } else if (s.status === 'resolved') {
    try {
      const value = lookup(s.scope, tag)
      entry = { status: 'resolved', value, promise: Promise.resolve(value) }
    } catch (error) {
      entry = { status: 'rejected', error, promise: Promise.resolve() }
    }
  } else {
    state.start()
    const promise: Promise<unknown> = state.scope
      .then((scope) => {
        const value = lookup(scope, tag)
        Object.assign(entry, { status: 'resolved', value })
      })
      .catch((error: unknown) => {
        Object.assign(entry, { status: 'rejected', error })
      })
    entry = { status: 'pending', promise }
  }
  state.cache.set(tag, entry)
  return entry
}

/**
 * Reads a service from the nearest {@link LayerProvider}, suspending while its scope builds.
 *
 * @param tag - The service's Tag.
 * @returns The service instance.
 * @throws `Error` when there is no `LayerProvider` above.
 * @throws `MissingDependency` when the Tag is not provided.
 * @throws The scope's build failure, to the nearest error boundary.
 *
 * @example
 * ```tsx
 * import { Context } from 'effect'
 * import { useService } from '@sleekstack/react'
 *
 * class Clock extends Context.Tag('Clock')<Clock, { now(): number }>() {}
 * const Now = () => <span>{useService(Clock).now()}</span>
 * ```
 */
export function useService<T>(tag: Context.Tag<any, T>): T {
  const state = useContext(ProviderContext)
  if (state === null) {
    throw new Error(
      `Service "${tagName(tag)}" is not provided: no <LayerProvider> above this component. Wrap it in a <LayerProvider provide={[...]}> that provides "${tagName(tag)}".`,
    )
  }
  const entry = entryFor(state, tag)
  // Order matters: resolved -> rejected -> pending.
  if (entry.status === 'resolved') return entry.value as T
  if (entry.status === 'rejected') throw entry.error
  throw entry.promise
}
