import { Context, Effect, Layer, Option } from 'effect'

type Segment<S extends string> = S extends `:${infer K}` ? { readonly [k in K]: string } : {}

/**
 * The params of a path string: `'/users/:id/posts/:post'` gives `{ id: string; post: string }`.
 * Only a whole segment starting with `:` is a param, as in `match`.
 */
export type Params<P extends string> = string extends P
  ? Record<string, string>
  : P extends `${infer Head}/${infer Rest}`
    ? Segment<Head> & Params<Rest>
    : Segment<P>

/** A route table: route names to path strings. Declare it with `routes` to keep the paths literal. */
export type RouteTable = { readonly [name: string]: string }

/** Identity that keeps the table's path strings literal so `Params` can read them (ADR 0036). */
export const routes = <const T extends RouteTable>(table: T): T => table

/** A matched route: its table name, path string, params and the pathname it matched. */
export interface Match<T extends RouteTable = RouteTable, K extends keyof T & string = keyof T & string> {
  readonly name: K
  readonly path: T[K]
  readonly params: Params<T[K]>
  readonly pathname: string
}

/** The matched route, provided around the page by `routeLayer`. */
export class Route extends Context.Tag('@sleekstack/router/Route')<Route, Match>() {}

/** Path segments without the leading and trailing slash; internal empty segments are kept. */
const segments = (s: string) => s.replace(/^\/|\/$/g, '').split('/')

const decode = (segment: string): string | undefined => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return undefined
  }
}

/**
 * The first route (in table order) whose path matches `pathname` segment by segment; `:name` matches one
 * non-empty segment. `pathname` segments are percent-decoded; a malformed escape matches no route.
 */
export const match = <T extends RouteTable>(table: T, pathname: string): Option.Option<Match<T>> => {
  const actual = segments(pathname).map(decode)
  if (actual.some((a) => a === undefined)) return Option.none()
  for (const name of Object.keys(table)) {
    const pattern = segments(table[name]!)
    if (pattern.length !== actual.length) continue
    const params: Record<string, string> = Object.create(null)
    const ok = pattern.every((p, i) => {
      const a = actual[i]!
      if (!p.startsWith(':')) return p === a
      params[p.slice(1)] = a
      return a !== ''
    })
    if (ok) return Option.some({ name, path: table[name], params, pathname } as Match<T>)
  }
  return Option.none()
}

/** Provides `m` as the `Route` service: `<Provider layer={routeLayer(m)}>` or `Provide(routeLayer(m), page)`. */
export const routeLayer = (m: Match<any, any>): Layer.Layer<Route> => Layer.succeed(Route, m as Match)

/**
 * The matched route's params typed from `table[name]`. Dies when the matched route is not `name`,
 * which is a wiring defect (the page was rendered under another route).
 */
export const params = <T extends RouteTable, K extends keyof T & string>(
  table: T,
  name: K,
): Effect.Effect<Params<T[K]>, never, Route> =>
  Effect.flatMap(Route, (m) =>
    m.name === name && m.path === table[name]
      ? Effect.succeed(m.params as Params<T[K]>)
      : Effect.dieMessage(`@sleekstack/router: page for '${name}' rendered under route '${m.name}'`),
  )

export { action } from './action'
export { Link } from './link'
export type { LinkProps } from './link'
export { loader, Loaders, LoaderTransferLive, prefetchLoader, useLoader } from './loader'
export type { Loader } from './loader'
