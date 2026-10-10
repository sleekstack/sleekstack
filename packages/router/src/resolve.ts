import type { Node } from '@sleekstack/ui'
import { Data, Effect, Option } from 'effect'
import { match, routeLayer, type Match, type RouteTable } from './index'
import { type Loader, type Loaders, useLoader } from './loader'

/** Raised by a loader or action: go to `to` instead (R9). Control flow, not a failure. */
export class Redirect extends Data.TaggedError('Redirect')<{ readonly to: string }> {}
/** Raised by a loader or action: render the router's not-found page (404 on the server). */
export class NotFound extends Data.TaggedError('NotFound')<{}> {}
/** More than `MAX_REDIRECTS` redirects in a row while resolving one navigation (R15). */
export class RedirectLoop extends Data.TaggedError('RedirectLoop')<{ readonly to: string }> {}

export const redirect = (to: string): Effect.Effect<never, Redirect> => Effect.fail(new Redirect({ to }))
export const notFound = (): Effect.Effect<never, NotFound> => Effect.fail(new NotFound())

/** Redirects followed in one navigation before it fails with `RedirectLoop`. */
export const MAX_REDIRECTS = 10

/** A page: renders the route's view; `loaders` run (and settle redirect / not-found) before it shows. */
export interface Page {
  readonly render: () => Effect.Effect<Node, any, any>
  readonly loaders?: ReadonlyArray<Loader<any, any, any, any>>
}

/** A route table with a page per route and the page shown when nothing matches. */
export interface Router<T extends RouteTable = RouteTable> {
  readonly table: T
  readonly pages: { readonly [K in keyof T]: Page }
  readonly notFound: () => Effect.Effect<Node, any, any>
}

/** Identity that keeps the table literal and checks there is a page per route. */
export const router = <const T extends RouteTable>(r: Router<T>): Router<T> => r

export type Resolved =
  | { readonly _tag: 'Page'; readonly match: Match; readonly href: string }
  | { readonly _tag: 'NotFound'; readonly href: string }
  | { readonly _tag: 'External'; readonly href: string }

const control = (e: unknown) =>
  e instanceof Redirect || e instanceof NotFound ? Effect.succeed(e) : Effect.fail(e as never)

/**
 * Matches `href` and runs its page's loaders into `Loaders`, following redirects. Fails with a loader's error, or
 * `RedirectLoop` past `MAX_REDIRECTS`. Interrupting it interrupts the loads it started.
 */
export const resolve = (r: Router, href: string, origin: string): Effect.Effect<Resolved, unknown, Loaders> =>
  Effect.gen(function* () {
    for (let hops = 0; ; hops++) {
      const url = new URL(href, origin)
      if (url.origin !== origin) return { _tag: 'External', href } as const
      const m = match(r.table, url.pathname)
      if (Option.isNone(m)) return { _tag: 'NotFound', href } as const
      const loads = Effect.forEach(r.pages[m.value.name]!.loaders ?? [], (l) => useLoader(l), {
        concurrency: 'unbounded',
        discard: true,
      })
      const step = yield* loads.pipe(
        Effect.provide(routeLayer(m.value)),
        Effect.as(undefined),
        Effect.catchAll(control),
      )
      if (step === undefined) return { _tag: 'Page', match: m.value, href } as const
      if (step._tag === 'NotFound') return { _tag: 'NotFound', href } as const
      if (hops >= MAX_REDIRECTS) return yield* new RedirectLoop({ to: step.to })
      href = step.to
    }
  }) as Effect.Effect<Resolved, unknown, Loaders>
