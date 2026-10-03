import { type Cause, Effect, type Layer, Schema } from 'effect'
import { createElement } from 'react'
import { renderToString as reactRenderToString } from 'react-dom/server'
import { type Atom, type AtomStore, makeAtomStore } from '@sleekstack/core'
import { reportRenderError, runToNode } from './component'
import { checkEvent, DuplicateBindKey, DuplicateHandler, type Handler, valueInfo } from './handler'
import type { Node } from './node'
import { Store } from './reactive'

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escape = (s: string): string => s.replace(/[&<>"']/g, (c) => ESCAPES[c]!)

const TAG = /^[a-zA-Z][a-zA-Z0-9-]*$/
const ATTR = /^[^\s"'<>\/=\x00-\x1f]+$/
/** Rejects invalid tag names and the renderer-written `sleek-reactive`. */
export const checkTag = (name: string): string => checkName(TAG, 'tag', name)
const checkName = (re: RegExp, kind: string, name: string): string => {
  if (!re.test(name) || (kind === 'tag' && name.toLowerCase() === 'sleek-reactive')) throw new TypeError(`Invalid ${kind} name: ${JSON.stringify(name)}`)
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

// Handler ids and bind keys must survive an HTML attribute round trip unchanged.
const ID = /^[A-Za-z0-9_.:/-]+$/
const checkId = (kind: string, id: string): string => {
  if (!ID.test(id)) throw new TypeError(`Invalid ${kind}: ${JSON.stringify(id)}`)
  return id
}

// fn-17's codec; render rechecks the value kind for Bind nodes not built by `bind`.
const encode = (atom: Atom.Atom<any>, key: string, value: unknown): unknown =>
  Schema.encodeSync(valueInfo(atom, key).schema)(value)

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

const serialize = (node: Node, c: Collector): string => {
  switch (node._tag) {
    case 'Text':
      return escape(node.text)
    case 'Bind': {
      const seen = c.atoms.get(node.key)
      if (seen && seen.atom !== node.atom) throw new DuplicateBindKey({ key: node.key })
      checkId('bind key', node.key)
      const value = c.store.get(node.atom)
      if (!seen) c.atoms.set(node.key, { atom: node.atom, value: encode(node.atom, node.key, value) })
      return `<sleek-bind data-sleek-bind="${escape(node.key)}">${escape(String(value))}</sleek-bind>`
    }
    case 'Fragment':
      return node.children.map((x) => serialize(x, c)).join('')
    case 'Element': {
      checkTag(node.tag)
      const attrs = Object.entries(node.attrs)
        .map(([k, v]) => (checkAttr(k, v), ` ${k}="${escape(v)}"`))
        .join('')
      const on = node.on ? handlerAttrs(node.on, c) : ''
      return `<${node.tag}${attrs}${on}>${node.children.map((x) => serialize(x, c)).join('')}</${node.tag}>`
    }
    case 'Reactive':
      return serialize(node.child, c)
    case 'Guest':
      try {
        const html = reactRenderToString(createElement(node.component, node.props))
        // Guests stay inert under resume: any `data-sleek-` in their markup is rejected (parser-proof; also rejects such text).
        if (/data-sleek-/i.test(html)) throw new TypeError('A guest rendered a reserved data-sleek-* attribute')
        return html
      } catch (error) {
        reportRenderError(error, c.onError)
        return ''
      }
  }
}

/**
 * String renderer (SSR and tests). Rejection contract matches `mount`. Provides a fresh `Store`, disposed afterwards.
 * Handlers (`on`) and `bind` nodes emit `data-sleek-*` attributes and one trailing manifest script; rejects with
 * `DuplicateHandler`, `DuplicateBindKey` or `UnsupportedEvent`.
 */
export const renderToString = async <E, A, LE = never>(
  app: Effect.Effect<Node, E, A>,
  opts: { layer: Layer.Layer<Exclude<A, Store>, LE, never>; onError?: (cause: Cause.Cause<unknown>) => void },
): Promise<string> => {
  const store = makeAtomStore()
  try {
    const withStore = Effect.provideService(app, Store, store) as Effect.Effect<Node, E, Exclude<A, Store>>
    const node = await runToNode(withStore, opts.layer, opts.onError)
    const c: Collector = { store, onError: opts.onError, handlers: new Map(), events: new Set(), atoms: new Map() }
    const html = serialize(node, c)
    return html + manifest(c)
  } finally {
    await store.dispose()
  }
}
