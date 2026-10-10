import { type Node, renderToStream, renderToString } from '@sleekstack/ui'
import { Cause, Effect, Exit, Layer, Option, Runtime } from 'effect'
import { routeLayer } from './index'
import { type Held, Loaders, withLoaders } from './loader'
import { controlOf, isControl, type NotFound, Redirect, resolve, type Router } from './resolve'

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

const js = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c')

// Wraps the stream in the document; `late()` is markup to send before the next chunk (or the end), for a redirect or
// not-found raised after the status was sent.
const wrap = (body: ReadableStream<Uint8Array>, d: { before: string; after: string }, late: () => Promise<string>) => {
  const enc = new TextEncoder()
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      start: (c) => c.enqueue(enc.encode(d.before)),
      transform: async (chunk, c) => {
        c.enqueue(chunk)
        const l = await late()
        if (l) c.enqueue(enc.encode(l))
      },
      flush: async (c) => c.enqueue(enc.encode((await late()) + d.after)),
    }),
  )
}

/**
 * Turns a request into a response (R10). A string render runs the page's declared loaders first, so a redirect is a
 * 302 to where the redirects end, a not-found is a 404 with the router's not-found page, and a loader failure renders
 * the page (its `Boundary` shows the error) with the error's status. `stream: true` does the same, then sends the shell first
 * and a redirect or not-found from an undeclared loader as a script (see `stream`). Loader results ride the hydration payload either way.
 */
export const handle = async (r: Router, request: Request, opts: HandleOptions = {}): Promise<Response> => {
  const url = new URL(request.url)
  const href = url.pathname + url.search
  const base = opts.layer ?? Layer.empty
  const all = new Map<string, Held>()
  const doc = opts.document ?? { before: '', after: '' }
  const exit = await Effect.runPromiseExit(
    Effect.provide(resolve(r, href, url.origin), Layer.merge(Layer.succeed(Loaders, all), base)),
  )
  const fail = (cause: Cause.Cause<unknown>) => (opts.onError?.(cause), new Response(null, { status: 500 }))
  if (Exit.isFailure(exit)) return fail(exit.cause)
  const res = exit.value
  if (res.href !== href) return redirectTo(res.href)
  const loaders = withLoaders(all).pipe(Layer.provideMerge(base))
  const notFoundPage = (): Promise<Response> => render(r.notFound(), loaders, 404)
  const render = async (
    page: Effect.Effect<Node, any, any>,
    layer: Layer.Layer<any, any>,
    status: number,
  ): Promise<Response> => {
    if (opts.stream) return stream(r, [page, layer, status], loaders, doc, opts)
    // A loader the page reads without declaring it on its route can still redirect or not-find: the string render
    // answers it like a declared one.
    let ctl: Redirect | NotFound | undefined
    const onError = (cause: Cause.Cause<unknown>) => {
      const c = controlOf(cause)
      if (c) ctl ??= c
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

// Shell first (R15): the declared loaders have settled the status; loaders the page reads without declaring them run
// under its `Pending` after the shell is sent. A redirect or not-found they raise is sent as a script:
// `location.replace` to the target, or the not-found page's markup in place of the document's body.
const stream = async (
  r: Router,
  [page, layer, status]: readonly [Effect.Effect<Node, any, any>, Layer.Layer<any, any>, number],
  loaders: Layer.Layer<any, any>,
  doc: { before: string; after: string },
  opts: HandleOptions,
): Promise<Response> => {
  let ctl: Redirect | NotFound | undefined
  let sent = false
  const late = async () => {
    if (!ctl || sent) return ''
    sent = true
    if (ctl instanceof Redirect) return `<script>location.replace(${js(ctl.to)})</script>`
    const missing = await renderToString(r.notFound(), { layer: loaders }).catch(() => '')
    return `<template id="sleek-router-404">${missing}</template><meta name="robots" content="noindex"><script>document.body.replaceChildren(document.getElementById('sleek-router-404').content)</script>`
  }
  const onError = (cause: Cause.Cause<unknown>) => {
    const c = controlOf(cause)
    if (c) ctl ??= c
    else opts.onError?.(cause)
  }
  return new Response(wrap(renderToStream(page, { layer, onError }), doc, late), { status, headers: HTML })
}
