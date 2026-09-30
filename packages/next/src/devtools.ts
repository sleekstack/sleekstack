/**
 * packages/next/src/devtools.ts
 *
 * `@sleekstack/next/devtools`: a dev-only route handler exposing the runtime's scope/error buffer and,
 * when given one, the analyzer graph Report. Its own entry, so production server bundles never import it.
 */

import { devEnabled, devEvents, devLive, type DevEvent } from './runtime'

export type { DevEvent } from './runtime'

/** The handler's JSON body. `graph` is present only when a Report source was given. */
export interface DevtoolsSnapshot {
  readonly scopes: readonly DevEvent[]
  readonly errors: readonly DevEvent[]
  /** Open request scopes and app-runtime state; unaffected by history eviction. */
  readonly live: { readonly app: boolean; readonly scopes: readonly string[] }
  readonly graph?: unknown
}

export interface DevtoolsOptions {
  /** Returns the analyzer `Report` (`@sleekstack/analyze`); omitted → scopes/errors only. */
  readonly graph?: () => unknown
}

/** The current buffer split into scopes (scope/acquire/release) and errors, plus the graph when available. */
export function devtoolsSnapshot(options: DevtoolsOptions = {}): DevtoolsSnapshot {
  const events = devEvents()
  const snapshot = { scopes: events.filter((e) => e.kind !== 'error'), errors: events.filter((e) => e.kind === 'error'), live: devLive() }
  return options.graph ? { ...snapshot, graph: options.graph() } : snapshot
}

/**
 * A `GET` route handler returning {@link devtoolsSnapshot} as JSON in dev and 404 in production.
 *
 * @example
 * ```ts
 * // app/api/devtools/route.ts
 * import { devtoolsHandler } from '@sleekstack/next/devtools'
 * export const GET = devtoolsHandler()
 * ```
 */
export function devtoolsHandler(options: DevtoolsOptions = {}): () => Response {
  return () =>
    devEnabled() ? Response.json(devtoolsSnapshot(options)) : new Response('Not Found', { status: 404 })
}
