import { renderToStream, renderToString } from '@sleekstack/ui'
import { Cause, Effect, Exit, Layer, Option } from 'effect'
import { match, routeLayer } from './index'
import { type Held, Loaders, withLoaders } from './loader'
import { RedirectLoop, resolve, type Router } from './resolve'

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
  let status = 200
  let m = match(r.table, url.pathname)
  if (Exit.isSuccess(exit)) {
    const res = exit.value
    if (res.href !== href) return new Response(null, { status: 302, headers: { location: res.href } })
    if (res._tag === 'NotFound') ((status = 404), (m = Option.none()))
  } else {
    const e = Cause.failureOption(exit.cause)
    if (Option.isNone(e) || e.value instanceof RedirectLoop) return fail(exit.cause)
    status = statusOf(e.value)
  }
  const page = Option.isSome(m) ? r.pages[m.value.name]!.render() : r.notFound()
  const loaders = withLoaders(all).pipe(Layer.provideMerge(base))
  const layer = Option.isSome(m) ? Layer.merge(loaders, routeLayer(m.value)) : loaders
  const doc = opts.document ?? { before: '', after: '' }
  if (opts.stream)
    return new Response(wrap(renderToStream(page, { layer, onError: opts.onError }), doc), { status, headers: HTML })
  try {
    const html = await renderToString(page, { layer, onError: opts.onError })
    return new Response(doc.before + html + doc.after, { status, headers: HTML })
  } catch (error) {
    return fail(Cause.die(error))
  }
}
