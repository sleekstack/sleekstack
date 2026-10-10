import { hydrateMount, type Mounted, mount, type Node } from '@sleekstack/ui'
import { Cause, Effect, Exit, Fiber, Layer, Option } from 'effect'
import { match, routeLayer } from './index'
import { type Held, Loaders, withLoaders } from './loader'
import { NotFound, Redirect, RedirectLoop, resolve, type Router } from './resolve'

export interface StartOptions {
  /** The element the pages render into. Server-rendered content in it is hydrated. */
  readonly container: Element
  /** App services for loaders and pages. */
  readonly layer?: Layer.Layer<any, any, never>
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
 * back / forward and scroll restoration. A navigation runs the next page's loaders before it shows; a newer one
 * interrupts it, stopping its loads. A loader's or action's `redirect` navigates and its `notFound` shows the router's
 * not-found page.
 */
export const startRouter = async (r: Router, opts: StartOptions): Promise<Navigation> => {
  const { container } = opts
  const base = opts.layer ?? Layer.empty
  const all = new Map<string, Held>()
  const loaders = withLoaders(all).pipe(Layer.provideMerge(base))
  const scrolls = new Map<string, number>()
  const newKey = () => Math.random().toString(36).slice(2)
  let key: string = history.state?.key ?? newKey()
  history.replaceState({ ...history.state, key }, '')
  history.scrollRestoration = 'manual'
  let nav: Fiber.RuntimeFiber<void, unknown> | undefined
  let mounted: Mounted | undefined

  const onError = (cause: Cause.Cause<unknown>) => {
    const e = Cause.failureOption(cause)
    if (Option.isSome(e) && e.value instanceof Redirect) void go(e.value.to, 'push')
    else if (Option.isSome(e) && e.value instanceof NotFound) void show(r.notFound())
    else opts.onError?.(cause)
  }
  const show = async (app: Effect.Effect<Node, any, any>, route?: Layer.Layer<any>) => {
    mounted = await mount(app, { container, layer: route ? Layer.merge(loaders, route) : loaders, onError })
  }
  const page = (pathname: string) => {
    const m = match(r.table, pathname)
    return Option.isSome(m)
      ? ([r.pages[m.value.name]!.render(), routeLayer(m.value)] as const)
      : ([r.notFound(), undefined] as const)
  }

  const go = (href: string, mode: Mode): Promise<void> => {
    scrolls.set(key, scrollY)
    if (mode === 'pop') key = history.state?.key ?? newKey()
    if (nav) Effect.runFork(Fiber.interrupt(nav))
    const run = Effect.gen(function* () {
      const exit = yield* Effect.exit(
        Effect.provide(resolve(r, href, location.origin), Layer.merge(Layer.succeed(Loaders, all), base)),
      )
      const e = Exit.isFailure(exit) ? Cause.failureOption(exit.cause) : Option.none()
      if (Exit.isFailure(exit) && (Option.isNone(e) || e.value instanceof RedirectLoop))
        return opts.onError?.(exit.cause)
      // A loader error still shows the page: its `Boundary` shows the error.
      const res = Exit.isSuccess(exit) ? exit.value : { _tag: 'Page' as const, href }
      if (res._tag === 'External') return location.assign(res.href)
      if (mode === 'push') history.pushState({ key: (key = newKey()) }, '', res.href)
      else if (mode === 'replace' || res.href !== href) history.replaceState({ key }, '', res.href)
      const [app, route] =
        res._tag === 'NotFound' ? [r.notFound(), undefined] : page(new URL(res.href, location.href).pathname)
      yield* Effect.promise(() => show(app, route))
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
    if (url.origin !== location.origin) return
    ev.preventDefault()
    void go(url.pathname + url.search + url.hash, 'push')
  }
  const onPop = () => void go(location.pathname + location.search + location.hash, 'pop')
  container.addEventListener('click', onClick)
  addEventListener('popstate', onPop)

  if (container.hasChildNodes()) {
    // The server already settled the loaders and sent their results: adopt its DOM without running them again.
    const [app, route] = page(location.pathname)
    mounted = await hydrateMount(app, { container, layer: route ? Layer.merge(loaders, route) : loaders, onError })
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
