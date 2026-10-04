import { type Cause, Context, Effect, Exit, Fiber, Layer, Option, Scope } from 'effect'
import { type AtomStore, dehydrate, makeAtomStore } from '@sleekstack/core'
import { QueryClientTag } from '@sleekstack/query'
import { dehydrate as dehydrateQueries, type QueryClient } from '@tanstack/query-core'
import { nodeOrThrow, reportRenderError } from './component'
import type { Node, ReactiveNode } from './node'
import { disposeSlots, Frame, makeFrame, RenderScope, Store } from './reactive'
import { type Around, checkId, type Collector, escape, payload, scriptJson, serialize, serializeAll } from './string'

// Swap runtime, emitted once in the shell: replaces `<!--sleek-p:ID-->fallback<!--/sleek-p-->` with the chunk's template.
const SWAP =
  "self.__sleekSwap=function(i){var t=document.querySelector('template[data-sleek-b=\"'+i+'\"]'),w=document.createTreeWalker(document,128),n;" +
  "while((n=w.nextNode())&&n.data!=='sleek-p:'+i);if(!n||!t)return;var p=n.parentNode,d=0,x=n.nextSibling;" +
  "while(x){var y=x.nextSibling;if(x.nodeType===8){if(x.data.indexOf('sleek-p:')===0)d++;else if(x.data==='/sleek-p'){if(!d){p.removeChild(x);break}d--}}p.removeChild(x);x=y}" +
  'p.replaceChild(t.content,n);t.remove()}'

export interface StreamOptions<A, LE> {
  readonly layer: Layer.Layer<A, LE, never>
  /** Set on every inline script. */
  readonly nonce?: string
  /** Prefix of placeholder ids; distinct per stream when several share a page. Default `sleek-`. */
  readonly idPrefix?: string
  readonly onError?: (cause: Cause.Cause<unknown>) => void
}

// Resolves once one of the instance's atoms differs from what its run read.
const changed = (store: AtomStore, node: ReactiveNode): Promise<void> =>
  new Promise((resolve) => {
    const unsubs: Array<() => void> = []
    const done = () => (unsubs.forEach((u) => u()), resolve())
    for (const a of node.atoms) unsubs.push(store.subscribe(a, done))
    if (node.atoms.some((a, i) => store.get(a) !== node.seen?.[i])) done()
  })

/**
 * Streaming SSR: the shell flushes first, each unresolved `Pending` as a `<!--sleek-p:ID-->` placeholder around its
 * fallback; each resolved boundary follows as a `<template data-sleek-b="ID">` chunk and a swap call. A failure before
 * the shell flushes errors the stream with the original error. The store, scopes and fibers live until the last
 * boundary settles and are disposed on completion, error or cancel. The shell and each chunk carry a `data-sleek-hydrate`
 * script with the atom and query state changed since the previous one (`hydrateMount` merges them in order).
 * No resume manifest is emitted.
 */
export const renderToStream = <E, A, LE = never>(app: Effect.Effect<Node, E, A>, opts: StreamOptions<Exclude<A, Store>, LE>): ReadableStream<Uint8Array> => {
  const prefix = checkId('idPrefix', opts.idPrefix ?? 'sleek-')
  const nonce = opts.nonce === undefined ? '' : ` nonce="${escape(opts.nonce)}"`
  const encoder = new TextEncoder()
  const store = makeAtomStore({ scheduleTask: () => {} })
  const scope = Effect.runSync(Scope.make())
  const frame = makeFrame()
  let shell: Fiber.RuntimeFiber<Node, unknown> | undefined
  const reruns = new Set<Fiber.RuntimeFiber<Node>>()
  let disposed: Promise<void> | undefined
  const dispose = () =>
    (disposed ??= (async () => {
      if (shell) await Effect.runPromise(Fiber.interrupt(shell))
      await Effect.runPromise(Fiber.interruptAll(reruns))
      disposeSlots(frame.owner)
      await Effect.runPromise(Scope.close(scope, Exit.void))
      await store.dispose()
    })())

  let next = 0
  const waiting: Array<Promise<void>> = []
  const c: Collector = { store, onError: opts.onError, handlers: new Map(), events: new Set(), atoms: new Map() }
  let emit: (html: string) => void = () => {}
  let client: QueryClient | undefined
  // State sent so far: atom key -> encoded JSON, query hash -> dataUpdatedAt. One Collector spans the stream.
  const sentAtoms = new Map<string, string>()
  const sentQueries = new Map<string, number>()
  const state = (): string => {
    const atoms = Object.fromEntries(
      Object.entries(dehydrate(store)).filter(([k, v]) => {
        const json = JSON.stringify(v)
        return sentAtoms.get(k) !== json && (sentAtoms.set(k, json), true)
      }),
    )
    const all = client ? dehydrateQueries(client) : undefined
    const queries = all && {
      ...all,
      queries: all.queries.filter((q) => sentQueries.get(q.queryHash) !== q.state.dataUpdatedAt && (sentQueries.set(q.queryHash, q.state.dataUpdatedAt), true)),
    }
    return payload(atoms, queries)
  }

  // Placeholder now; the chunk when the boundary's content resolves. A failure streams the nearest `Boundary` fallback
  // (the re-run carries the instance's handlers); unhandled, the Pending fallback stays and `onError` gets it.
  c.boundary = (node, around: Around) => {
    if (node.pending?.frame) return undefined
    const id = `${prefix}${next++}`
    const settle = async (n: ReactiveNode): Promise<void> => {
      await changed(store, n)
      if (disposed) return
      const fiber = Effect.runFork(n.rerun)
      reruns.add(fiber)
      const exit = await Effect.runPromise(Fiber.await(fiber))
      reruns.delete(fiber)
      if (disposed) return
      if (Exit.isFailure(exit)) return void reportRenderError(exit.cause, opts.onError)
      const r = exit.value
      if (r._tag === 'Reactive' && r.pending && !r.pending.frame) return settle(r)
      // Content renders in the placeholder's text context, so swapped text keeps the separators renderToString writes.
      const html = serializeAll([r._tag === 'Reactive' ? r.child : r], c, around)
      emit(`${state()}<template data-sleek-b="${id}">${html}</template><script${nonce}>__sleekSwap(${scriptJson(id)})</script>`)
    }
    waiting.push(settle(node))
    return `<!--sleek-p:${id}-->${serialize(node.child, c)}<!--/sleek-p-->`
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const run = Effect.flatMap(Layer.buildWithScope(opts.layer, scope), (ctx) => {
        client = Option.getOrUndefined(Context.getOption(ctx, QueryClientTag))
        return Effect.provide(app, ctx)
      }).pipe(
        Effect.provideService(Store, store),
        Effect.provideService(Frame, frame),
        Effect.provideService(RenderScope, scope),
      ) as Effect.Effect<Node, unknown, never>
      shell = Effect.runFork(run)
      const exit = await Effect.runPromise(Fiber.await(shell))
      shell = undefined
      let html: string
      try {
        html = serialize(nodeOrThrow(exit, opts.onError), c)
        html += state()
      } catch (error) {
        await dispose()
        throw error
      }
      if (waiting.length === 0) {
        controller.enqueue(encoder.encode(html))
        controller.close()
        return void (await dispose())
      }
      controller.enqueue(encoder.encode(`<script${nonce}>${SWAP}</script>${html}`))
      emit = (chunk) => controller.enqueue(encoder.encode(chunk))
      // A boundary nested in resolved content joins `waiting` before its parent settles, so the index walk sees it.
      void (async () => {
        for (let i = 0; i < waiting.length; i++) await waiting[i]!.catch(() => {})
        if (disposed) return
        await dispose()
        controller.close()
      })()
    },
    cancel: dispose,
  })
}
