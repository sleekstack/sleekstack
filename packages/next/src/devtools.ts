/**
 * packages/next/src/devtools.ts
 *
 * `@sleekstack/next/devtools`: a dev-only route handler exposing the runtime's scope/error buffer and,
 * when given one, the analyzer graph Report. Its own entry, so production server bundles never import it.
 */

import { devEnabled, devEvents, devLive, type DevEvent } from '@sleekstack/runtime/internal'

export type { DevEvent } from '@sleekstack/runtime/internal'

/** The handler's JSON body. `graph` is present only when a Report source was given. */
export interface DevtoolsSnapshot {
  /** True when tracing is off (production): the buffer is empty because nothing records, not because nothing happened. */
  readonly disabled: boolean
  readonly scopes: readonly DevEvent[]
  readonly errors: readonly DevEvent[]
  /** Open request scopes and app-runtime state; unaffected by history eviction. */
  readonly live: { readonly app: boolean; readonly scopes: readonly string[] }
  readonly graph?: unknown
}

/** Options for {@link devtoolsHandler} and {@link devtoolsSnapshot}. */
export interface DevtoolsOptions {
  /** Returns the analyzer `Report` (`@sleekstack/analyze`); omitted → scopes/errors only. */
  readonly graph?: () => unknown
  /** Serve requests whose host is not loopback (e.g. a phone on the LAN). Default: loopback only, since errors carry stack traces. */
  readonly allowRemote?: boolean
}

/** The current buffer split into scopes (scope/acquire/release) and errors, plus the graph when available. */
export function devtoolsSnapshot(options: DevtoolsOptions = {}): DevtoolsSnapshot {
  const events = devEvents()
  const snapshot = {
    disabled: !devEnabled(),
    scopes: events.filter((e) => e.kind !== 'error'),
    errors: events.filter((e) => e.kind === 'error'),
    live: devLive(),
  }
  return options.graph ? { ...snapshot, graph: options.graph() } : snapshot
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

/**
 * A `GET` route handler returning {@link devtoolsSnapshot} as JSON in dev (loopback hosts only unless `allowRemote`; 403 otherwise) and 404 in production.
 *
 * @example
 * ```ts
 * // app/api/devtools/route.ts
 * import { devtoolsHandler } from '@sleekstack/next/devtools'
 * export const GET = devtoolsHandler()
 * ```
 */
export function devtoolsHandler(options: DevtoolsOptions = {}): { (): Response; (request: Request): Response } {
  return (request?: Request) => {
    if (!devEnabled()) return new Response('Not Found', { status: 404 })
    if (request && !options.allowRemote && !LOOPBACK.has(new URL(request.url).hostname))
      return new Response('Forbidden', { status: 403 })
    return Response.json(devtoolsSnapshot(options))
  }
}
