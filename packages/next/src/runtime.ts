/**
 * packages/next/src/runtime.ts
 *
 * The Next adapter's app runtime (R8). `configureRuntime` stores the config;
 * the app scope is built lazily on first use and held in a process-global
 * slot (`effect/GlobalValue`) so dev HMR does not duplicate it. The same
 * config reference again is a no-op; a different config disposes the
 * existing app scope and replaces it.
 */

import { buildGraph, makeAppScope, type AppScope, type Entry, type Module } from '@sleekstack/core'
import { Cause, Effect } from 'effect'
import { globalValue } from 'effect/GlobalValue'

export interface RuntimeConfig {
  readonly provide: readonly (Module | Entry)[]
  readonly onFinalizerError?: (cause: Cause.Cause<unknown>) => void
}

interface RuntimeSlot {
  config: RuntimeConfig | undefined
  appScope: AppScope | undefined
  building: Promise<AppScope> | undefined
}

const getSlot = (): RuntimeSlot =>
  globalValue('@sleekstack/next/runtime-slot', (): RuntimeSlot => ({
    config: undefined,
    appScope: undefined,
    building: undefined,
  }))

export const defaultFinalizerSink = (cause: Cause.Cause<unknown>): void => console.error(Cause.pretty(cause))

export const sinkFor = (config: RuntimeConfig): ((cause: Cause.Cause<unknown>) => void) =>
  config.onFinalizerError ?? defaultFinalizerSink

/** The current config's finalizer sink, or `undefined` if unconfigured. */
export const getConfiguredSink = (): ((cause: Cause.Cause<unknown>) => void) | undefined => {
  const config = getSlot().config
  return config ? sinkFor(config) : undefined
}

/** Stores the runtime config. Same reference again is a no-op; a different reference replaces it. */
export function configureRuntime(config: RuntimeConfig): void {
  const slot = getSlot()
  if (slot.config === config) return
  if (slot.config !== undefined) {
    console.warn(
      '[@sleekstack/next] configureRuntime() was called again with a different config; disposing the previous app runtime and replacing it.',
    )
    const previousSink = sinkFor(slot.config)
    if (slot.appScope) slot.appScope.dispose()
    else if (slot.building) slot.building.then((scope) => scope.dispose()).catch((error: unknown) => previousSink(Cause.die(error)))
  }
  slot.config = config
  slot.appScope = undefined
  slot.building = undefined
}

/** Descriptive error for an unconfigured call, thrown at call time. */
export class RuntimeNotConfigured extends Error {
  constructor() {
    super('[@sleekstack/next] action/query was called before configureRuntime(); call configureRuntime({ provide }) first.')
    this.name = 'RuntimeNotConfigured'
  }
}

/** Resolves the app scope, building it lazily (and only once) on first use. */
export function ensureAppScope(): Promise<AppScope> {
  const slot = getSlot()
  const config = slot.config
  if (config === undefined) return Promise.reject(new RuntimeNotConfigured())
  if (slot.appScope) return Promise.resolve(slot.appScope)
  if (!slot.building) {
    const building: Promise<AppScope> = Effect.runPromise(
      makeAppScope(buildGraph(config.provide), { onFinalizerError: config.onFinalizerError }),
    )
      .then((scope) => {
        slot.appScope = scope
        return scope
      })
      .catch((error: unknown) => {
        // Building failed: clear so the next call can retry rather than replaying a stale rejection forever.
        if (slot.building === building) slot.building = undefined
        throw error
      })
    slot.building = building
  }
  return slot.building
}
