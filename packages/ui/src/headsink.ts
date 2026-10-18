import { Context } from 'effect'
import type { ElementNode } from './node'

/** What `<Head>` registers: its tags and the component depth it was written at. */
export interface HeadSinkApi {
  /** Registers `nodes` (`title`, `meta`, `link` elements); the returned function removes them. */
  add(nodes: ReadonlyArray<ElementNode>, depth: number): () => void
  /** The tag per key now in effect, in registration order: the deepest registration wins, a later one on a tie. */
  resolved(): ReadonlyArray<{ readonly key: string; readonly node: ElementNode }>
}

/** The dedupe key of a head tag: `title`, `meta[name|property|http-equiv]`, `link[rel]+href`; a meta with none is never deduped. */
export const headKey = (node: ElementNode, seq: number): string => {
  const a = node.attrs
  if (node.tag === 'title') return 'title'
  if (node.tag === 'link') return `link[${a.rel ?? ''}]+${a.href ?? ''}`
  for (const k of ['name', 'property', 'http-equiv']) if (a[k] !== undefined) return `meta[${k}=${a[k]}]`
  return a.charset !== undefined ? 'meta[charset]' : `meta#${seq}`
}

export const makeHeadSink = (onChange?: () => void): HeadSinkApi => {
  const regs = new Set<{ node: ElementNode; key: string; depth: number; seq: number }>()
  let seq = 0
  return {
    add: (nodes, depth) => {
      const mine = nodes.map((node) => ({ node, key: headKey(node, ++seq), depth, seq }))
      for (const r of mine) regs.add(r)
      onChange?.()
      return () => {
        for (const r of mine) regs.delete(r)
        onChange?.()
      }
    },
    resolved: () => {
      const win = new Map<string, { node: ElementNode; depth: number; seq: number }>()
      for (const r of regs) {
        const w = win.get(r.key)
        if (!w || r.depth > w.depth || (r.depth === w.depth && r.seq > w.seq)) win.set(r.key, r)
      }
      return [...win].sort((x, y) => x[1].seq - y[1].seq).map(([key, { node }]) => ({ key, node }))
    },
  }
}

const textOf = (node: ElementNode): string => node.children.map((c) => (c._tag === 'Text' ? c.text : '')).join('')

/** Keeps `doc.head` equal to the sink's resolved tags: updates what it created, adds the new, removes the dropped. Patches once per microtask. */
const domSink = (doc: Document): HeadSinkApi => {
  const owned = new Map<string, Element>()
  let queued = false
  const sink: HeadSinkApi = makeHeadSink(() => {
    if (queued) return
    queued = true
    queueMicrotask(() => {
      queued = false
      const next = new Map(sink.resolved().map((r) => [r.key, r.node]))
      for (const [k, el] of owned) if (!next.has(k)) (el.remove(), owned.delete(k))
      for (const [k, node] of next) {
        let el = owned.get(k)
        if (!el) {
          // An existing `<title>` is taken over rather than duplicated.
          el = (node.tag === 'title' && doc.head.querySelector('title')) || doc.createElement(node.tag)
          owned.set(k, el)
        }
        for (const name of el.getAttributeNames()) if (!(name in node.attrs)) el.removeAttribute(name)
        for (const [name, v] of Object.entries(node.attrs)) if (el.getAttribute(name) !== v) el.setAttribute(name, v)
        if (node.tag === 'title' && el.textContent !== textOf(node)) el.textContent = textOf(node)
        if (!el.isConnected) doc.head.append(el)
      }
    })
  })
  return sink
}

// Everything outside `renderToString` (the DOM renderer provides nothing) lands here: one sink for the page's `document.head`.
// ponytail: global document, not the mount container's; per-mount documents (iframes) need `mount` to provide a sink.
const NONE: HeadSinkApi = { add: () => () => {}, resolved: () => [] }
let page: HeadSinkApi | undefined
const pageSink = (): HeadSinkApi => (typeof document === 'undefined' ? NONE : (page ??= domSink(document)))

/** The render's head registry. `renderToString` provides its own; unset, `<Head>` patches the page's `document.head` (nothing without a DOM). */
export class HeadSink extends Context.Reference<HeadSink>()('@sleekstack/ui/HeadSink', {
  defaultValue: (): HeadSinkApi => ({
    add: (nodes, depth) => pageSink().add(nodes, depth),
    resolved: () => pageSink().resolved(),
  }),
}) {}
