import { Context, Effect, Exit, Fiber, Layer, Option, Runtime, Scope } from 'effect'
import { type AtomStore, dehydrate, makeAtomStore } from '@sleekstack/core'
import { nodeOrThrow, reportRenderError, type RunOptions } from './component'
import type { Node, ReactiveNode } from './node'
import { disposeSlots, Frame, makeFrame, RenderScope, Store } from './reactive'
import { Transfer, type StateTransfer } from './transfer'
import {
  type Around,
  checkId,
  type Collector,
  escape,
  type HeadMark,
  headHtml,
  headWinners,
  payload,
  scriptJson,
  serialize,
  serializeAll,
} from './string'

// Swap runtime, emitted once in the shell: replaces `<!--sleek-p:ID-->fallback<!--/sleek-p-->` with the chunk's template.
const SWAP =
  "self.__sleekSwap=function(i){var t=document.querySelector('template[data-sleek-b=\"'+i+'\"]'),w=document.createTreeWalker(document,128),n;" +
  "while((n=w.nextNode())&&n.data!=='sleek-p:'+i);if(!n||!t)return;var p=n.parentNode,d=0,x=n.nextSibling;" +
  "while(x){var y=x.nextSibling;if(x.nodeType===8){if(x.data.indexOf('sleek-p:')===0)d++;else if(x.data==='/sleek-p'){if(!d){p.removeChild(x);break}d--}}p.removeChild(x);x=y}" +
  'p.replaceChild(t.content,n);t.remove()};' +
  // Stream end with boundaries that never got a chunk: kept for a client that hydrates later (`hydrateMount` reports them).
  'self.__sleekEnd=function(m){(self.__sleekGone=self.__sleekGone||[]).push.apply(self.__sleekGone,m)};' +
  // Late head patch: `[selector, [tag, attrs, text] | 0]` per key; 0 removes the key's tag.
  'self.__sleekHead=function(l){var h=document.head;l.forEach(function(e){var s=e[0],t=e[1],el=[].find.call(h.children,function(x){' +
  "return x.localName===s[0]&&(s.length<2||x.getAttribute(s[1])===s[2]&&(s[1]!=='property'||!x.hasAttribute('name')))});" +
  'if(!t)return void(el&&el.remove());el=el||h.appendChild(document.createElement(t[0]));' +
  '[].slice.call(el.attributes).forEach(function(a){if(!Object.prototype.hasOwnProperty.call(t[1],a.name))el.removeAttribute(a.name)});' +
  "for(var k in t[1])el.setAttribute(k,t[1][k]);if(t[0]==='title')el.textContent=t[2]})}"

// Late head policy (ADR 0044): after the shell flushed, only `title` and keyed `meta` change; `link` and unkeyed tags are
// shell-only. Each patchable key maps to its winner's `[tag, attrs, text]` as script JSON.
const patchable = (marks: ReadonlyArray<HeadMark>): Map<string, string> => {
  const out = new Map<string, string>()
  for (const [k, t] of headWinners(marks))
    if (typeof k === 'string' && t.tag !== 'link') out.set(k, scriptJson([t.tag, t.attrs, t.text]))
  return out
}
// The keys whose winner changed, as a `__sleekHead` argument; '' when none did.
const headPatch = (before: Map<string, string>, after: Map<string, string>): string => {
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter((k) => before.get(k) !== after.get(k))
  if (changed.length === 0) return ''
  const entry = (k: string) => `[${scriptJson(k === 'title' ? ['title'] : JSON.parse(k))},${after.get(k) ?? 0}]`
  return `__sleekHead([${changed.map(entry).join(',')}])`
}

/** Options for `renderToStream`: the layer that provides the tree's services. */
export interface StreamOptions<A, LE> extends RunOptions {
  readonly layer: Layer.Layer<A, LE, never>
  /** Set on every inline script. */
  readonly nonce?: string
  /** Prefix of placeholder ids; distinct per stream when several share a page. Default `sleek-`. */
  readonly idPrefix?: string
  /**
   * Receives the shell's `Head` markup once, before the first chunk (the same markup `renderToString` gives for the same
   * tags). Set, a boundary that resolves later patches `document.head` per ADR 0044: `title` and keyed `meta` follow
   * the boundary (its fallback's tags go, its content's arrive); `link` and unkeyed tags stay as the shell had them.
   */
  readonly onHead?: (html: string) => void
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
export const renderToStream = <E, A, LE = never>(
  app: Effect.Effect<Node, E, A>,
  opts: StreamOptions<Exclude<A, Store>, LE>,
): ReadableStream<Uint8Array> => {
  const prefix = checkId('idPrefix', opts.idPrefix ?? 'sleek-')
  const nonce = opts.nonce === undefined ? '' : ` nonce="${escape(opts.nonce)}"`
  const encoder = new TextEncoder()
  const fork = Runtime.runFork(opts.runtime ?? Runtime.defaultRuntime)
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
  const c: Collector = {
    store,
    onError: opts.onError,
    handlers: new Map(),
    events: new Set(),
    atoms: new Map(),
    head: [],
  }
  // Head ownership: a context is a boundary's fallback (its id) or its content (`c:` + id), nested in the context the
  // boundary sits in. A mark lives while no context up its chain is retired: a fallback once its content swapped in,
  // content once it failed to serialize (it never reaches the page).
  let current: string | undefined
  const within = new Map<string, string | undefined>()
  const retired = new Set<string>()
  const owner = new Map<HeadMark, string | undefined>()
  const own = (from: number, ctx: string | undefined) => {
    for (const m of c.head!.slice(from)) if (!owner.has(m)) owner.set(m, ctx)
  }
  const live = (m: HeadMark): boolean => {
    for (let x = owner.get(m); x !== undefined; x = within.get(x)) if (retired.has(x)) return false
    return true
  }
  const liveHead = () => c.head!.filter(live)
  let emit: (html: string) => void = () => {}
  let transfer: StateTransfer | undefined
  // Atom state sent so far: key -> encoded JSON (the `Transfer` tracks its own). One Collector spans the stream.
  const sentAtoms = new Map<string, string>()
  // Boundary paths: Pendings numbered per enclosing boundary in serialize order (`hydrateMount` numbers them alike).
  let parent = ''
  const counts = new Map<string, number>()
  let paths: Record<string, string> = {}
  const unsent = new Set<string>()
  const state = (): string => {
    const atoms = Object.fromEntries(
      Object.entries(dehydrate(store)).filter(([k, v]) => {
        const json = JSON.stringify(v)
        return sentAtoms.get(k) !== json && (sentAtoms.set(k, json), true)
      }),
    )
    const sent = transfer?.dehydrate()
    const b = paths
    paths = {}
    // The nonce goes on the data script too, so every script in the stream carries it.
    return payload(atoms, sent, b).replace('<script ', `<script${nonce} `)
  }

  // Placeholder now; the chunk when the boundary's content resolves. A failure streams the nearest `Boundary` fallback
  // (the re-run carries the instance's handlers); unhandled, the Pending fallback stays and `onError` gets it.
  c.boundary = (node, around: Around) => {
    const n = counts.get(parent) ?? 0
    counts.set(parent, n + 1)
    if (node.pending?.frame) return undefined
    const path = parent ? `${parent}.${n}` : String(n)
    const id = `${prefix}${next++}`
    paths[id] = path
    unsent.add(id)
    const settle = async (n: ReactiveNode): Promise<void> => {
      await changed(store, n)
      if (disposed) return
      const fiber = fork(n.rerun)
      reruns.add(fiber)
      const exit = await Effect.runPromise(Fiber.await(fiber))
      reruns.delete(fiber)
      if (disposed) return
      if (Exit.isFailure(exit)) return void reportRenderError(exit.cause, opts.onError)
      const r = exit.value
      if (r._tag === 'Reactive' && r.pending && !r.pending.frame) return settle(r)
      // Content renders in the placeholder's text context, so swapped text keeps the separators renderToString writes.
      const outer = [parent, current] as const
      const content = `c:${id}`
      within.set(content, within.get(id))
      parent = path
      current = content
      const before = patchable(liveHead())
      const from = c.head!.length
      let html: string
      try {
        html = serializeAll([r._tag === 'Reactive' ? r.child : r], c, around)
      } catch (error) {
        retired.add(content)
        throw error
      } finally {
        own(from, content)
        ;[parent, current] = outer
      }
      retired.add(id)
      unsent.delete(id)
      const patch = opts.onHead ? headPatch(before, patchable(liveHead())) : ''
      emit(
        `${state()}<template data-sleek-b="${id}">${html}</template><script${nonce}>__sleekSwap(${scriptJson(id)})${patch && `;${patch}`}</script>`,
      )
    }
    waiting.push(settle(node))
    within.set(id, current)
    const outer = current
    const from = c.head!.length
    current = id
    let fallback: string
    try {
      fallback = serialize(node.child, c)
    } finally {
      own(from, id)
      current = outer
    }
    return `<!--sleek-p:${id}-->${fallback}<!--/sleek-p-->`
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const run = Effect.flatMap(Layer.buildWithScope(opts.layer, scope), (ctx) => {
        transfer = Option.getOrUndefined(Context.getOption(ctx, Transfer))
        return Effect.provide(app, ctx)
      }).pipe(
        Effect.provideService(Store, store),
        Effect.provideService(Frame, frame),
        Effect.provideService(RenderScope, scope),
      ) as Effect.Effect<Node, unknown, never>
      shell = fork(run)
      const exit = await Effect.runPromise(Fiber.await(shell))
      shell = undefined
      let html: string
      try {
        html = serialize(nodeOrThrow(exit, opts.onError), c)
        html += state()
        opts.onHead?.(headHtml(liveHead()))
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
        if (unsent.size > 0)
          controller.enqueue(encoder.encode(`<script${nonce}>__sleekEnd(${scriptJson([...unsent])})</script>`))
        await dispose()
        controller.close()
      })()
    },
    cancel: dispose,
  })
}
