import { type Child, LazyLoadError, type Node, Pending, type Store, type Transfer } from '@sleekstack/ui'
import { jsx } from '@sleekstack/ui/jsx-runtime'
import { Cause, Data, Effect, type Layer, Option } from 'effect'
import { match, type Route, routeLayer, type Match, type RouteTable } from './index'
import { keyOf, type Loader, Loaders, useLoader } from './loader'

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

/**
 * A page's code: renders the route's view; `loaders` run (and settle redirect / not-found) before it shows. `R` is
 * what its render and loaders need; `startRouter` and `handle` take a layer providing it. A JSX render adds nothing to
 * `R`: ui types JSX as requirement-free, so a component's services are checked by `sleekstack check`, not here.
 */
export interface PageCode<R = any> {
  readonly render: () => Effect.Effect<Node, any, R>
  readonly loaders?: ReadonlyArray<Loader<any, any, any, R>>
  /** Shown while a loader the page reads is still loading; the router wraps the page in `Pending` with it. */
  readonly fallback?: Child
}

/**
 * A page: its code, or a `load` that imports it. The router loads a page with `load` and no `render` once, before
 * its loaders run or it renders; concurrent navigations share the load, and a rejected one is tried again next time.
 */
export type Page<R = any> = PageCode<R> | { readonly load: () => Promise<PageCode<R>> }

const loaded = new WeakMap<Page, PageCode>()
const loading = new WeakMap<Page, Promise<PageCode>>()

/** `page`'s code, loading it once; a rejected load (or one without `render`) fails with `LazyLoadError`, uncached. */
const codeOf = (page: Page): Effect.Effect<PageCode, LazyLoadError> =>
  Effect.suspend(() => {
    if ('render' in page) return Effect.succeed(page)
    const done = loaded.get(page)
    if (done) return Effect.succeed(done)
    let p = loading.get(page)
    if (!p) {
      // A `load` that throws synchronously rejects like one whose import fails.
      p = new Promise<PageCode>((ok) => ok(page.load()))
        .then((c) => {
          if (typeof c?.render !== 'function') throw new TypeError('@sleekstack/router: loaded page has no render')
          loaded.set(page, c)
          return c
        })
        .finally(() => loading.delete(page))
      loading.set(page, p)
    }
    // Not tied to this fiber: an interrupted navigation stops waiting, the load goes on for the others sharing it.
    const shared = p
    return Effect.tryPromise({ try: () => shared, catch: (cause) => new LazyLoadError({ cause }) })
  })

const failed = (e: LazyLoadError): PageCode => ({ render: () => Effect.fail(e) })

/** `page`'s code, or one whose render fails with the load's `LazyLoadError`, which reaches the nearest `Boundary`. */
export const loadPage = (page: Page): Effect.Effect<PageCode> =>
  Effect.catchAll(codeOf(page), (e) => Effect.succeed(failed(e)))

/** The routed page under its `Pending`: a loader read suspends to `fallback`, its error reaches the nearest `Boundary`. */
export const view = (page: PageCode): Effect.Effect<Node, never, never> =>
  jsx(Pending, { fallback: page.fallback, children: page.render() })

/**
 * A route table with a page per route and the page shown when nothing matches; `R` is what the pages need beyond
 * `Route` (which the router provides to matched pages) plus everything `notFound` needs.
 */
export interface Router<T extends RouteTable = RouteTable, R = any> {
  readonly table: T
  readonly pages: { readonly [K in keyof T]: Page<R> }
  readonly notFound: () => Effect.Effect<Node, any, R>
}

// `Route` is provided around matched pages only, so it is dropped here and kept in what `notFound` needs.
type CodeNeeds<P> =
  | (P extends { readonly render: () => Effect.Effect<any, any, infer R> } ? R : never)
  | (P extends { readonly loaders: ReadonlyArray<Loader<any, any, any, infer R>> } ? R : never)
type PageNeeds<P> = Exclude<
  CodeNeeds<P> | (P extends { readonly load: () => Promise<infer C> } ? CodeNeeds<C> : never),
  Route
>

/** Services the router provides around every page, the not-found page included; an app's layer never has to. */
export type RouterProvided = Loaders | Transfer | Store

/** What a router's pages, loaders and not-found page need from the app's layer. */
export type Requirements<R> = Exclude<R, RouterProvided>

/**
 * The app layer option of `startRouter` and `handle`: required and checked when the pages need services, optional
 * when they need none (or when the router's requirements are not tracked, as for a `Router` annotated without `R`).
 */
export type AppLayer<R> = 0 extends 1 & R
  ? { readonly layer?: Layer.Layer<any, any, never> }
  : [Requirements<R>] extends [never]
    ? { readonly layer?: Layer.Layer<any, any, never> }
    : { readonly layer: Layer.Layer<Requirements<R>, any, never> }

/** Identity that keeps the table literal, checks there is a page per route, and infers what the pages need. */
export const router = <const T extends RouteTable, P extends { readonly [K in keyof T]: Page }, N = never>(r: {
  readonly table: T
  readonly pages: P
  readonly notFound: () => Effect.Effect<Node, any, N>
}): Router<T, PageNeeds<P[keyof P]> | N> => r as Router<T, PageNeeds<P[keyof P]> | N>

export type Resolved =
  | {
      readonly _tag: 'Page'
      readonly match: Match
      readonly href: string
      /** The page's loaded code; its render fails with the `LazyLoadError` when its load was rejected. */
      readonly code: PageCode
      readonly error?: unknown
    }
  | { readonly _tag: 'NotFound'; readonly href: string }
  | { readonly _tag: 'External'; readonly href: string }

export const isControl = (e: unknown): e is Redirect | NotFound => e instanceof Redirect || e instanceof NotFound

/** The redirect or not-found in `cause`, also when a renderer reported it wrapped as a defect. */
export const controlOf = (cause: Cause.Cause<unknown>): Redirect | NotFound | undefined => {
  const e = Cause.failureOption(cause)
  if (Option.isSome(e)) return isControl(e.value) ? e.value : undefined
  const d = Cause.dieOption(cause)
  if (Option.isNone(d)) return undefined
  return Cause.isCause(d.value) ? controlOf(d.value) : isControl(d.value) ? d.value : undefined
}

// Runs `l`; a failure other than control flow is held for the page's read to replay (so the loader runs once) and
// returned as the page's error.
const run = (l: Loader<any, any, any, any>, pathname: string) =>
  Effect.catchAllCause(Effect.as(useLoader(l), Option.none<unknown>()), (cause) => {
    const e = Cause.failureOption(cause)
    if (Option.isSome(e) && isControl(e.value)) return Effect.fail(e.value)
    return Effect.flatMap(Loaders, (all) =>
      Effect.as(
        Effect.sync(() => all.set(keyOf(l, pathname), { failure: cause, readers: 0 })),
        Option.some(Option.isSome(e) ? e.value : Cause.squash(cause)),
      ),
    )
  })

/**
 * Matches `href`, loads its page's code and runs its loaders into `Loaders`, following redirects. A rejected code load
 * or a loader's error is the page's `error`; fails only with `RedirectLoop` past `MAX_REDIRECTS`. Interrupting it
 * interrupts the loaders it started; a code load goes on for others sharing it.
 */
export const resolve = (r: Router, href: string, origin: string): Effect.Effect<Resolved, unknown, Loaders> =>
  Effect.gen(function* () {
    for (let hops = 0; ; hops++) {
      const url = new URL(href, origin)
      if (url.origin !== origin) return { _tag: 'External', href } as const
      const m = match(r.table, url.pathname)
      if (Option.isNone(m)) return { _tag: 'NotFound', href } as const
      const code = yield* Effect.either(codeOf(r.pages[m.value.name]!))
      if (code._tag === 'Left')
        return { _tag: 'Page', match: m.value, href, code: failed(code.left), error: code.left } as const
      const loads = Effect.forEach(code.right.loaders ?? [], (l) => run(l, url.pathname), { concurrency: 'unbounded' })
      const step = yield* loads.pipe(Effect.provide(routeLayer(m.value)), Effect.either)
      if (step._tag === 'Right') {
        const error = step.right.find(Option.isSome)
        return {
          _tag: 'Page',
          match: m.value,
          href,
          code: code.right,
          ...(error ? { error: error.value } : {}),
        } as const
      }
      const ctl = step.left as Redirect | NotFound
      if (ctl._tag === 'NotFound') return { _tag: 'NotFound', href } as const
      if (hops >= MAX_REDIRECTS) return yield* new RedirectLoop({ to: ctl.to })
      href = ctl.to
    }
  }) as Effect.Effect<Resolved, unknown, Loaders>
