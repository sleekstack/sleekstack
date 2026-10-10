import { type Node, renderToStream, renderToString } from '@sleekstack/ui'
import { Cause, Effect, Exit, Layer, Option, Runtime } from 'effect'
import { routeLayer } from './index'
import { type Held, Loaders, withLoaders } from './loader'
import { isControl, type NotFound, Redirect, resolve, type Router } from './resolve'

export interface HandleOptions {
  /** App services for loaders and pages; a `Transfer` it provides travels beside the loaders'. */
  readonly layer?: Layer.Layer<any, any, never>
  /** Stream the page (`renderToStream`) instead of rendering it to a string. */
  readonly stream?: boolean
  /** Markup around the rendered page: the document head before, the closing tags after. */
  readonly document?: { readonly before: string; readonly after: string }
  /** Gets a 500's cause: a `RedirectLoop`, a defect, or a render failure. */
  readonly onError?: (cause: Cause.Cause<unknown>) => void
}

const redirectTo = (location: string) => new Response(null, { status: 302, headers: { location } })

const HTML = { 'content-type': 'text/html; charset=utf-8' }

// A loader error with a numeric `status` (an HTTP error, say) sets the response status; any other is a 500.
const statusOf = (e: unknown): number => {
  const s = (e as { status?: unknown } | null)?.status
  return typeof s === 'number' && s >= 400 && s < 600 ? s : 500
}

const wrap = (body: ReadableStream<Uint8Array>, d: { before: string; after: string }) => {
  const enc = new TextEncoder()
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      start: (c) => c.enqueue(enc.encode(d.before)),
      flush: (c) => c.enqueue(enc.encode(d.after)),
    }),
  )
}

/**
 * Turns a request into a response (R10): runs the matched page's loaders first, so a redirect is a 302 to where the
 * redirects end, a not-found is a 404 with the router's not-found page, and a loader failure renders the page (its
 * `Boundary` shows the error) with the error's status. Then renders the page with the loaders' results in the
 * hydration payload, so the client does not load them again.
 */
export const handle = async (r: Router, request: Request, opts: HandleOptions = {}): Promise<Response> => {
  const url = new URL(request.url)
  const href = url.pathname + url.search
  const base = opts.layer ?? Layer.empty
  const all = new Map<string, Held>()
  const exit = await Effect.runPromiseExit(
    Effect.provide(resolve(r, href, url.origin), Layer.merge(Layer.succeed(Loaders, all), base)),
  )
  const fail = (cause: Cause.Cause<unknown>) => (opts.onError?.(cause), new Response(null, { status: 500 }))
  if (Exit.isFailure(exit)) return fail(exit.cause)
  const res = exit.value
  if (res.href !== href) return redirectTo(res.href)
  const loaders = withLoaders(all).pipe(Layer.provideMerge(base))
  const doc = opts.document ?? { before: '', after: '' }
  const notFoundPage = (): Promise<Response> => render(r.notFound(), loaders, 404)
  const render = async (
    page: Effect.Effect<Node, any, any>,
    layer: Layer.Layer<any, any>,
    status: number,
  ): Promise<Response> => {
    if (opts.stream)
      return new Response(wrap(renderToStream(page, { layer, onError: opts.onError }), doc), { status, headers: HTML })
    // A loader the page reads without declaring it on its route can still redirect or not-find: the string render
    // answers it like a declared one. A stream has sent its status by then.
    let ctl: Redirect | NotFound | undefined
    const onError = (cause: Cause.Cause<unknown>) => {
      const e = Cause.failureOption(cause)
      if (Option.isSome(e) && isControl(e.value)) ctl ??= e.value
      else opts.onError?.(cause)
    }
    let html = ''
    try {
      html = await renderToString(page, { layer, onError })
    } catch (error) {
      const e = Runtime.isFiberFailure(error) ? Cause.squash(error[Runtime.FiberFailureCauseId]) : error
      if (!isControl(e)) return fail(Cause.die(error))
      ctl ??= e
    }
    if (ctl instanceof Redirect) return redirectTo(ctl.to)
    if (ctl && status !== 404) return notFoundPage()
    return new Response(doc.before + html + doc.after, { status, headers: HTML })
  }
  if (res._tag !== 'Page') return notFoundPage()
  const status = 'error' in res ? statusOf(res.error) : 200
  return render(r.pages[res.match.name]!.render(), Layer.merge(loaders, routeLayer(res.match)), status)
}
