import { Context, Data, Effect, Layer } from 'effect'

/** The incoming request, read-only: method, url and headers. Its body belongs to the stage that answers it. */
export class Request extends Context.Tag('@sleekstack/start/Request')<Request, globalThis.Request>() {}

/** Headers added to the response, whichever stage answers. */
export class ResponseHeaders extends Context.Tag('@sleekstack/start/ResponseHeaders')<ResponseHeaders, Headers>() {}

/** `Set-Cookie` attributes. */
export interface CookieOptions {
  readonly path?: string
  readonly domain?: string
  readonly maxAge?: number
  readonly expires?: Date
  readonly httpOnly?: boolean
  readonly secure?: boolean
  readonly sameSite?: 'Strict' | 'Lax' | 'None'
}

/** A cookie name, value or attribute outside the cookie grammar (RFC 6265), refused instead of emitted. */
export class InvalidCookie extends Data.TaggedError('InvalidCookie')<{
  readonly name: string
  readonly part: 'name' | 'value' | 'path' | 'domain' | 'maxAge'
}> {}

/** The request's cookies; `set` and `delete` become `Set-Cookie` headers on the response. */
export interface CookieJar {
  /** The cookie's value: the request's, or this request's latest `set`. */
  readonly get: (name: string) => string | undefined
  readonly set: (name: string, value: string, options?: CookieOptions) => Effect.Effect<void, InvalidCookie>
  readonly delete: (
    name: string,
    options?: Pick<CookieOptions, 'path' | 'domain'>,
  ) => Effect.Effect<void, InvalidCookie>
}

export class Cookies extends Context.Tag('@sleekstack/start/Cookies')<Cookies, CookieJar>() {}

/** The services `start` provides to every stage of a request. */
export type RequestServices = Request | Cookies | ResponseHeaders

const TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/
const VALUE = /^(?:[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]*|"[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]*")$/
// An attribute value: any printable character but `;`.
const ATTRIBUTE = /^[\x20-\x3A\x3C-\x7E]*$/

const parse = (header: string | null): Map<string, string> => {
  const jar = new Map<string, string>()
  for (const pair of header?.split(';') ?? []) {
    const i = pair.indexOf('=')
    if (i === -1) continue
    const name = pair.slice(0, i).trim()
    if (name && !jar.has(name)) jar.set(name, pair.slice(i + 1).trim())
  }
  return jar
}

const serialize = (name: string, value: string, o: CookieOptions): Effect.Effect<string, InvalidCookie> => {
  const bad = !TOKEN.test(name)
    ? 'name'
    : !VALUE.test(value)
      ? 'value'
      : o.path !== undefined && !ATTRIBUTE.test(o.path)
        ? 'path'
        : o.domain !== undefined && !ATTRIBUTE.test(o.domain)
          ? 'domain'
          : o.maxAge !== undefined && !Number.isInteger(o.maxAge)
            ? 'maxAge'
            : undefined
  if (bad) return Effect.fail(new InvalidCookie({ name, part: bad }))
  let s = `${name}=${value}`
  if (o.path !== undefined) s += `; Path=${o.path}`
  if (o.domain !== undefined) s += `; Domain=${o.domain}`
  if (o.maxAge !== undefined) s += `; Max-Age=${o.maxAge}`
  if (o.expires) s += `; Expires=${o.expires.toUTCString()}`
  if (o.httpOnly) s += '; HttpOnly'
  if (o.secure) s += '; Secure'
  if (o.sameSite) s += `; SameSite=${o.sameSite}`
  return Effect.succeed(s)
}

/** One request's services and what they add to its response. */
export const requestServices = (request: globalThis.Request) => {
  const values = parse(request.headers.get('cookie'))
  const setCookies = new Map<string, string>()
  const headers = new Headers()
  const write = (name: string, value: string | undefined, options: CookieOptions) =>
    Effect.map(serialize(name, value ?? '', options), (line) => {
      setCookies.set(name, line)
      if (value === undefined) values.delete(name)
      else values.set(name, value)
    })
  const jar: CookieJar = {
    get: (name) => values.get(name),
    set: (name, value, options = {}) => write(name, value, options),
    delete: (name, options = {}) => write(name, undefined, { ...options, maxAge: 0 }),
  }
  return {
    layer: Layer.succeedContext(
      Context.make(Request, request).pipe(Context.add(Cookies, jar), Context.add(ResponseHeaders, headers)),
    ),
    /** `response` with the `ResponseHeaders` and `Set-Cookie` lines added. */
    finish: (response: Response): Response => {
      if (setCookies.size === 0 && [...headers].length === 0) return response
      const out = new Headers(response.headers)
      headers.forEach((v, k) => out.set(k, v))
      for (const line of setCookies.values()) out.append('set-cookie', line)
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers: out })
    },
  }
}
