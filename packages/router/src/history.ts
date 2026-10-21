import { hydrateMount, type Mounted, mount, type Node } from '@sleekstack/ui'
import { Cause, Effect, Exit, Fiber, Layer, Option } from 'effect'
import { match, routeLayer, type RouteTable } from './index'
import { type Held, isFor, Loaders, Navigating, withLoaders } from './loader'
import { type AppLayer, controlOf, loadPage, NotFound, Redirect, resolve, type Router, view } from './resolve'

/** `layer` is the app services for loaders and pages: required when the router's pages need any (`AppLayer`). */
export type StartOptions<R = never> = AppLayer<R> & {
  /** The element the pages render into. Server-rendered content in it is hydrated. */
  readonly container: Element
  /** Gets failures the router does not handle itself (a `RedirectLoop`, a page's unhandled error). */
  readonly onError?: (cause: Cause.Cause<unknown>) => void
}

/** A started router: `navigate` pushes `href` once its loaders settle; the latest navigation wins. */
export interface Navigation {
  navigate(href: string): Promise<void>
  dispose(): Promise<void>
}

type Mode = 'push' | 'replace' | 'pop'

/**
 * Runs `r` in the browser (R11): hydrates or mounts the current page, then handles same-origin link clicks,
 * back / forward and scroll restoration. A navigation runs the next page's loaders fresh before it shows, while the page
 * being left keeps reading the results it holds; once the next page shows, the results it does not use are dropped. A
 * newer navigation interrupts it, stopping its loads. A loader's or action's `redirect` navigates and its `notFound`
 * shows the router's not-found page.
 */
export const startRouter = async <T extends RouteTable, R>(
  router: Router<T, R>,
  opts: StartOptions<R>,
): Promise<Navigation> => {
  // The layer check is the signature's; inside, pages run under the merged layers.
  const r: Router = router
  const { container } = opts
  const base = opts.layer ?? Layer.empty
  const all = new Map<string, Held>()
  const loaders = withLoaders(all).pipe(Layer.provideMerge(base))
  const scrolls = new Map<string, number>()
  const newKey = () => Math.random().toString(36).slice(2)
  let key: string = history.state?.key ?? newKey()
  history.replaceState({ ...history.state, key }, '')
  history.scrollRestoration = 'manual'
  const here = (u: URL | Location) => u.pathname + u.search
  // The pathname and search of the page shown; a history step within it (a fragment) is not a navigation.
  let shown = here(location)
  let nav: Fiber.RuntimeFiber<void, unknown> | undefined
  // The latest navigation's record, which its loaders and the page it shows read through `Navigating`.
  let current: Navigating['Type'] | undefined
  let mounted: Mounted | undefined

  const onError = (cause: Cause.Cause<unknown>) => {
    const c = controlOf(cause)
    if (c instanceof Redirect) void go(c.to, 'push')
    else if (c instanceof NotFound) void show(r.notFound())
    else opts.onError?.(cause)
  }
  const show = async (app: Effect.Effect<Node, any, any>, route?: Layer.Layer<any>, navigating = {}) => {
    const layer = Layer.merge(loaders, Layer.succeed(Navigating, navigating))
    mounted = await mount(app, { container, layer: route ? Layer.merge(layer, route) : layer, onError })
  }

  const go = (href: string, mode: Mode): Promise<void> => {
    scrolls.set(key, scrollY)
    if (mode === 'pop') key = history.state?.key ?? newKey()
    if (nav) Effect.runFork(Fiber.interrupt(nav))
    // Each navigation loads again (R11): its loaders read the settled results as stale and replace them once loaded,
    // while the page being left keeps reading them. Loads in flight and unread prefetches are not stale.
    const settled = (h: Held) => !h.load && h.expires === undefined
    const stale = new Set([...all.values()].filter(settled))
    if (current) delete current.stale
    const rec: Navigating['Type'] = (current = { stale })
    const run = Effect.gen(function* () {
      const exit = yield* Effect.exit(
        Effect.provide(
          resolve(r, href, location.origin),
          Layer.mergeAll(Layer.succeed(Loaders, all), Layer.succeed(Navigating, rec), base),
        ),
      )
      // A `RedirectLoop` or defect; a loader's error still shows the page, whose `Boundary` gets it.
      if (Exit.isFailure(exit)) return opts.onError?.(exit.cause)
      const res = exit.value
      if (res._tag === 'External') return location.assign(res.href)
      if (mode === 'push') history.pushState({ key: (key = newKey()) }, '', res.href)
      else if (mode === 'replace' || res.href !== href) history.replaceState({ key }, '', res.href)
      const { pathname } = new URL(res.href, location.href)
      const [app, route] = res._tag === 'NotFound' ? [r.notFound(), undefined] : [view(res.code), routeLayer(res.match)]
      shown = here(new URL(res.href, location.href))
      yield* Effect.promise(() => show(app, route, rec))
      // Shown, unless a newer navigation has started and owns the map: drop the stale results nothing replaced and those
      // of other pathnames (redirect hops, the page left); results still loading fresh are read as they are from now.
      if (current === rec) {
        delete rec.stale
        for (const [k, h] of all)
          if (stale.has(h) || (settled(h) && !isFor(k, pathname))) all.delete(k)
          else delete h.prior
      }
      scrollTo(0, mode === 'pop' ? (scrolls.get(key) ?? 0) : 0)
    })
    const fiber = (nav = Effect.runFork(run))
    return Effect.runPromise(Effect.asVoid(Fiber.await(fiber)))
  }

  const onClick = (event: Event) => {
    const ev = event as MouseEvent
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return
    const a = (ev.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
    const url = new URL(a.href, location.href)
    // A fragment of the page shown is the browser's to scroll to.
    if (url.origin !== location.origin || (url.hash && here(url) === shown)) return
    ev.preventDefault()
    void go(url.pathname + url.search + url.hash, 'push')
  }
  const onPop = () => here(location) !== shown && void go(location.pathname + location.search + location.hash, 'pop')
  // Server markup is hydrated once its page's code is loaded, so the first render matches it. The router listens only
  // after that load: until then a link click is the browser's to follow, as before any script ran.
  const hydrate = container.hasChildNodes()
  const first = match(r.table, location.pathname)
  const app = !hydrate
    ? undefined
    : Option.isSome(first)
      ? view(await Effect.runPromise(loadPage(r.pages[first.value.name]!)))
      : r.notFound()
  container.addEventListener('click', onClick)
  addEventListener('popstate', onPop)

  if (app) {
    // The server already settled the loaders and sent their results: adopt its DOM without running them again.
    const layer = Option.isSome(first) ? Layer.merge(loaders, routeLayer(first.value)) : loaders
    mounted = await hydrateMount(app, { container, layer, onError })
  } else await go(location.pathname + location.search + location.hash, 'replace')

  return {
    navigate: (href) => go(href, 'push'),
    dispose: async () => {
      container.removeEventListener('click', onClick)
      removeEventListener('popstate', onPop)
      if (nav) await Effect.runPromise(Fiber.interrupt(nav))
      await mounted?.dispose()
    },
  }
}
