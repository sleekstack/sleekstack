import { type Cause, Effect, type Layer, Option, Schema } from 'effect'
import { createElement } from 'react'
import { renderToString as reactRenderToString } from 'react-dom/server'
import { type Atom, type AtomStore, dehydrate, makeAtomStore } from '@sleekstack/core'
import { QueryClientTag } from '@sleekstack/query'
import { dehydrate as dehydrateQueries, type DehydratedState } from '@tanstack/query-core'
import { reportRenderError, runToNode } from './component'
import { checkEvent, DuplicateBindKey, DuplicateHandler, type Handler, valueInfo } from './handler'
import type { ElementNode, Node } from './node'
import { Frame, makeFrame, Store } from './reactive'

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escape = (s: string): string => s.replace(/[&<>"']/g, (c) => ESCAPES[c]!)

const TAG = /^[a-zA-Z][a-zA-Z0-9-]*$/
const ATTR = /^[^\s"'<>\/=\x00-\x1f]+$/
/** Renderer-written host tags; user-built elements may not use them. */
const RESERVED_TAGS = new Set(['sleek-reactive', 'sleek-guest'])
/** Separates adjacent text nodes so HTML parsing keeps them apart (hydration maps one `Text` to one DOM text node). */
export const TEXT_SEPARATOR = '<!--sleek-t-->'
/** Rejects invalid tag names and the renderer-written `sleek-reactive` / `sleek-guest` hosts. */
export const checkTag = (name: string): string => checkName(TAG, 'tag', name)
const checkName = (re: RegExp, kind: string, name: string): string => {
  if (!re.test(name) || (kind === 'tag' && RESERVED_TAGS.has(name.toLowerCase()))) throw new TypeError(`Invalid ${kind} name: ${JSON.stringify(name)}`)
  return name
}

const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'xlink:href'])
/** Shared attribute policy: rejects invalid names, inline handlers, renderer-owned `data-sleek-*`, `srcdoc` and `javascript:` URLs. */
export const checkAttr = (name: string, value: string): void => {
  checkName(ATTR, 'attribute', name)
  const lower = name.toLowerCase()
  const unsafeUrl = URL_ATTRS.has(lower) && /^javascript:/i.test(value.replace(/[\s\x00-\x1f]/g, ''))
  if (lower.startsWith('on') || lower.startsWith('data-sleek-') || lower === 'srcdoc' || unsafeUrl)
    throw new TypeError(`Unsafe attribute: ${JSON.stringify(name)}`)
}

// Per-render resume state: handler ids, event types, bound atoms by key.
interface Collector {
  store: AtomStore
  onError?: (cause: Cause.Cause<unknown>) => void
  handlers: Map<string, Handler<any, any>>
  events: Set<string>
  atoms: Map<string, { atom: Atom.Atom<any>; value: unknown }> // value is encoded
}

const JSON_ESCAPES = /[<>&\u2028\u2029]/g
/** JSON safe inside a `<script>`: `<`, `>`, `&`, U+2028 and U+2029 become `\uXXXX`. */
const scriptJson = (value: unknown): string =>
  JSON.stringify(value).replace(JSON_ESCAPES, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)

const manifest = (c: Collector): string =>
  c.events.size === 0 && c.atoms.size === 0
    ? ''
    : `<script type="application/json" data-sleek-manifest>${scriptJson({
        v: 1,
        events: [...c.events],
        atoms: Object.fromEntries([...c.atoms].map(([k, { value }]) => [k, value])),
      })}</script>`

/**
 * Hydration state (`data-sleek-hydrate`, distinct from the resume manifest): core `dehydrate` atoms and TanStack
 * `DehydratedState` queries. Omitted when both are empty.
 */
const payload = (atoms: Record<string, unknown>, queries: DehydratedState | undefined): string => {
  const q = queries && (queries.queries.length > 0 || queries.mutations.length > 0) ? queries : undefined
  if (Object.keys(atoms).length === 0 && !q) return ''
  return `<script type="application/json" data-sleek-hydrate>${scriptJson({ v: 1, atoms, ...(q ? { queries: q } : {}) })}</script>`
}

// Handler ids and bind keys must survive an HTML attribute round trip unchanged.
const ID = /^[A-Za-z0-9_.:/-]+$/
const checkId = (kind: string, id: string): string => {
  if (!ID.test(id)) throw new TypeError(`Invalid ${kind}: ${JSON.stringify(id)}`)
  return id
}

// fn-17's codec; render rechecks the value kind for Bind nodes not built by `bind`.
const encode = (atom: Atom.Atom<any>, value: unknown): unknown =>
  Schema.encodeSync(valueInfo(atom).schema)(value)

const handlerAttrs = (on: Readonly<Record<string, Handler<any, any>>>, c: Collector): string =>
  Object.entries(on)
    .map(([event, h]) => {
      checkEvent(event)
      checkId('handler id', h.id)
      const seen = c.handlers.get(h.id)
      if (seen && seen !== h) throw new DuplicateHandler({ id: h.id })
      c.handlers.set(h.id, h)
      c.events.add(event)
      const flags = (h.opts.preventDefault ? ` data-sleek-pd-${event}` : '') + (h.opts.stopPropagation ? ` data-sleek-sp-${event}` : '')
      return ` data-sleek-on-${event}="${escape(h.id)}"${flags}`
    })
    .join('')

// Atom-valued attributes render their current value; they are not resumed.
const boundAttrs = (node: ElementNode, c: Collector): string =>
  Object.entries(node.bound ?? {})
    .map(([k, a]) => {
      const v = c.store.get(a)
      return v == null || v === false ? '' : (checkAttr(k, String(v)), ` ${k}="${v === true ? '' : escape(String(v))}"`)
    })
    .join('')

// Same host markup the DOM renderer creates (`dom.ts` build), so server DOM maps one-to-one onto the client tree.
const HOST_OPEN = (tag: string): string => `<${tag} style="display: contents;">`

// A plain atom binding renders as bare text, so it needs a separator next to other text like a Text node does.
const isText = (n: Node | undefined): boolean => n?._tag === 'Text' || (n?._tag === 'Bind' && !!n.plain)

const flatten = (nodes: ReadonlyArray<Node>): Array<Node> => nodes.flatMap((n) => (n._tag === 'Fragment' ? flatten(n.children) : [n]))
const serializeAll = (nodes: ReadonlyArray<Node>, c: Collector): string =>
  flatten(nodes)
    .map((n, i, list) => (isText(n) && isText(list[i - 1]) ? TEXT_SEPARATOR : '') + serialize(n, c))
    .join('')

const serialize = (node: Node, c: Collector): string => {
  switch (node._tag) {
    case 'Text':
      return escape(node.text)
    case 'Bind': {
      if (node.plain) return escape(String(c.store.get(node.atom)))
      const { key } = valueInfo(node.atom)
      const seen = c.atoms.get(key)
      if (seen && seen.atom !== node.atom) throw new DuplicateBindKey({ key })
      checkId('bind key', key)
      const value = c.store.get(node.atom)
      if (!seen) c.atoms.set(key, { atom: node.atom, value: encode(node.atom, value) })
      return `<sleek-bind data-sleek-bind="${escape(key)}">${escape(String(value))}</sleek-bind>`
    }
    case 'Fragment':
      return serializeAll(node.children, c)
    case 'Element': {
      checkTag(node.tag)
      const attrs = Object.entries(node.attrs)
        .map(([k, v]) => (checkAttr(k, v), ` ${k}="${escape(v)}"`))
        .join('') + boundAttrs(node, c)
      const on = node.on ? handlerAttrs(node.on, c) : ''
      return `<${node.tag}${attrs}${on}>${serializeAll(node.children, c)}</${node.tag}>`
    }
    case 'Reactive':
      return `${HOST_OPEN('sleek-reactive')}${serialize(node.child, c)}</sleek-reactive>`
    case 'Guest':
      try {
        const html = reactRenderToString(createElement(node.component, node.props))
        // Guests stay inert under resume: any `data-sleek-` in their markup is rejected (parser-proof; also rejects such text).
        if (/data-sleek-/i.test(html)) throw new TypeError('A guest rendered a reserved data-sleek-* attribute')
        return `${HOST_OPEN('sleek-guest')}${html}</sleek-guest>`
      } catch (error) {
        reportRenderError(error, c.onError)
        return ''
      }
  }
}

/**
 * String renderer (SSR and tests). Rejection contract matches `mount`. Provides a fresh `Store`, disposed afterwards.
 * Handlers (`on`) and `bind` nodes emit `data-sleek-*` attributes and one trailing manifest script; rejects with
 * `DuplicateHandler`, `DuplicateBindKey` or `UnsupportedEvent`. Serializable atom state and the layer's QueryClient
 * cache go into a trailing `data-sleek-hydrate` script that `hydrateMount` seeds from.
 */
export const renderToString = async <E, A, LE = never>(
  app: Effect.Effect<Node, E, A>,
  opts: { layer: Layer.Layer<Exclude<A, Store>, LE, never>; onError?: (cause: Cause.Cause<unknown>) => void },
): Promise<string> => {
  // Idle nodes stay until dispose, so `dehydrate` sees every atom the render built.
  const store = makeAtomStore({ scheduleTask: () => {} })
  try {
    let queries: DehydratedState | undefined
    // The scope's QueryClient (when the layer provides one) is dehydrated after the render's fetches settled.
    const captured = Effect.tap(app, () => Effect.map(Effect.serviceOption(QueryClientTag), (c) => void (queries = Option.isSome(c) ? dehydrateQueries(c.value) : undefined)))
    const withStore = captured.pipe(Effect.provideService(Store, store), Effect.provideService(Frame, makeFrame())) as Effect.Effect<Node, E, Exclude<A, Store>>
    const node = await runToNode(withStore, opts.layer, opts.onError)
    const c: Collector = { store, onError: opts.onError, handlers: new Map(), events: new Set(), atoms: new Map() }
    const html = serialize(node, c)
    return html + manifest(c) + payload(dehydrate(store), queries)
  } finally {
    await store.dispose()
  }
}
