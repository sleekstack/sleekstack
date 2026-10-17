/**
 * packages/runtime/src/devtools.ts
 *
 * `@sleekstack/runtime/devtools`: a dev-only `Request` to `Response` handler exposing the runtime's scope/error buffer and,
 * when given one, the analyzer graph Report. Its own entry, so a bundle importing only `@sleekstack/runtime` never contains it.
 */

import { devEnabled, devEvents, devLive, type DevEvent } from './runtime'

export type { DevEvent } from './runtime'

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

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

/** What the mounting server knows about the connection; a `Request` alone does not carry the peer. */
export interface DevtoolsConnection {
  /** The peer's IP address (e.g. Bun's `server.requestIP(request).address`, Node's `socket.remoteAddress`). Required unless `allowRemote`. */
  readonly remoteAddress?: string
}

/**
 * A web-standard fetch handler returning {@link devtoolsSnapshot} as JSON in dev and 404 in production.
 * Without `allowRemote` it answers 403 unless the server passes a loopback peer `remoteAddress` and the request URL's
 * host is loopback too (the URL host comes from the client's `Host` header, so it never proves locality on its own).
 *
 * @example
 * ```ts
 * import { devtoolsHandler } from '@sleekstack/runtime/devtools'
 * const devtools = devtoolsHandler()
 * Bun.serve({ fetch: (request, server) => devtools(request, { remoteAddress: server.requestIP(request)?.address }) })
 * ```
 */
export function devtoolsHandler(
  options: DevtoolsOptions = {},
): (request: Request, connection?: DevtoolsConnection) => Response {
  return (request, connection = {}) => {
    if (!devEnabled()) return new Response('Not Found', { status: 404 })
    const local =
      LOOPBACK_HOSTS.has(new URL(request.url).hostname) &&
      connection.remoteAddress !== undefined &&
      LOOPBACK_ADDRESSES.has(connection.remoteAddress)
    if (!options.allowRemote && !local) return new Response('Forbidden', { status: 403 })
    return Response.json(devtoolsSnapshot(options))
  }
}
