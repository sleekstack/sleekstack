import { Data } from 'effect'

/** An `origins` entry that is not a bare origin (scheme, host and optional port). */
export class InvalidOrigin extends Data.TaggedError('InvalidOrigin')<{ readonly origin: string }> {}

const BARE = /^[a-z][a-z\d+.-]*:\/\/[^/?#@\\\s]+\/?$/i

/**
 * `entry` as the browser writes it in an `Origin` header: lower-case, no trailing slash, no default port. Throws
 * `InvalidOrigin` for anything else (a path, query, credentials, a bare host or `*`), which would never match.
 */
export const normalizeOrigin = (entry: string): string => {
  // Checked before parsing too: `URL` would fold `https://a.test/x/..` or `https://@a.test` into a bare origin.
  const url = BARE.test(entry) ? URL.parse(entry) : null
  if (!url || url.origin === 'null' || url.href !== `${url.origin}/`) throw new InvalidOrigin({ origin: entry })
  return url.origin
}

/**
 * Whether a server-function call may run: its `Origin` is the request's own or one of `allowed` (normalized). Without an
 * `Origin` only a browser's `Sec-Fetch-Site: same-origin` passes, so a client that sends neither is refused.
 */
export const allowedOrigin = (request: Request, allowed: ReadonlyArray<string>): boolean => {
  const origin = request.headers.get('origin')
  if (origin === null) return request.headers.get('sec-fetch-site') === 'same-origin'
  return origin === new URL(request.url).origin || allowed.includes(origin)
}
