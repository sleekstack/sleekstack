import { Atom } from '@sleekstack/core'
import { type Context, Effect, Layer } from 'effect'
import { bind, type Handler, isHandler, on } from './handler'
import { el, type ElementNode, type EventBinding, fragment, type Node } from './node'
import { type HostDescriptor, Handlers, hostBuilder, hostOf, instance, RenderScope } from './reactive'

/** What a JSX expression may hold between its tags. A serializable atom renders its current value as text and, under `renderToString`, is bound for `resume`. */
export type Child = string | number | boolean | null | undefined | Effect.Effect<Node, any, any> | Atom.Serializable<Atom.Atom<any>> | ReadonlyArray<Child>

/** Every JSX expression is an `Effect<Node>`. Its requirements and errors are read from the tree by `sleekstack check`, not by tsc. */
type Element = Effect.Effect<Node, never, never>
type Props = Record<string, unknown> & { children?: Child }

const rendered = (c: Child): Array<Effect.Effect<Node | string, any, any>> =>
  Array.isArray(c)
    ? c.flatMap(rendered)
    : c == null || typeof c === 'boolean'
      ? []
      : Atom.isAtom(c)
        ? [Effect.sync(() => bind(c))]
        : [Effect.isEffect(c) ? c : Effect.succeed(String(c))]

const renderChildren = (c: Child) => Effect.all(rendered(c)) as Effect.Effect<Array<Node | string>>

// Attributes are strings in the Node tree: `className` / `htmlFor` map to `class` / `for`, `true` is an empty value, nullish and `false` are dropped.
const RENAME: Record<string, string> = { className: 'class', htmlFor: 'for' }
const attrs = (props: Props): Record<string, string> =>
  Object.fromEntries(
    Object.entries(props).flatMap(([k, v]) =>
      k === 'children' || k === 'key' || isEvent(k, v) || isHandlerProp(k, v) || v == null || v === false ? [] : [[RENAME[k] ?? k, v === true ? '' : String(v)]],
    ),
  )

// A function-valued `onXxx` prop is an event closure, not an attribute; non-function `on*` still reaches `checkAttr`.
const isEvent = (k: string, v: unknown): v is EventBinding['run'] => typeof v === 'function' && /^on[A-Z]/.test(k)
// A `defineHandler` value on `onXxx` is a resumable handler: it goes to the node's `on`, which `renderToString` emits as `data-sleek-on-<event>`.
const isHandlerProp = (k: string, v: unknown): v is Handler<any, any> => /^on[A-Z]/.test(k) && isHandler(v)
const handlers = (props: Props): Record<string, Handler<any, any>> | undefined => {
  const entries = Object.entries(props).flatMap(([k, v]) => (isHandlerProp(k, v) ? [[k.slice(2).toLowerCase(), v] as const] : []))
  return entries.length ? Object.fromEntries(entries) : undefined
}
const events = (props: Props, context: Context.Context<any>): Record<string, EventBinding> | undefined => {
  const entries = Object.entries(props).flatMap(([k, v]) => (isEvent(k, v) ? [[k.slice(2).toLowerCase(), { run: v, context }]] : []))
  return entries.length ? Object.fromEntries(entries) : undefined
}

const element = (type: string, props: Props, key: string | undefined): Effect.Effect<Node, any, any> =>
  Effect.flatMap(Effect.context<any>(), (ctx) =>
    Effect.map(renderChildren(props.children), (kids) => {
      const base = el(type, attrs(props), ...kids) as ElementNode
      const hs = handlers(props)
      const node = (hs ? on(base, hs) : base) as ElementNode
      const evs = events(props, ctx)
      return { ...node, ...(evs && { events: evs }), ...(key !== undefined && { key }) }
    }),
  )

// Plain host tree: primitive attributes and text, nested plain host elements. Its output is its props, so it is built (and compared) synchronously.
const isPrim = (v: unknown): boolean => v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
const hostNode = (d: HostDescriptor, key: string | undefined): Node | undefined => {
  const p = d._hp as Props
  for (const k in p) if (k !== 'children' && (/^on[A-Z]/.test(k) || !isPrim(p[k]))) return undefined
  const kids = hostChildren(p.children, [])
  if (!kids) return undefined
  const base = el(d._ht, attrs(p), ...kids) as ElementNode
  return key === undefined ? base : { ...base, key }
}
const hostChildren = (c: unknown, out: Array<Node | string>): Array<Node | string> | undefined => {
  if (Array.isArray(c)) {
    for (const x of c) if (!hostChildren(x, out)) return undefined
    return out
  }
  if (c == null || typeof c === 'boolean') return out
  if (typeof c === 'string' || typeof c === 'number') return out.push(String(c)), out
  const h = hostOf(c)
  const n = h && hostNode(h, h._hk)
  return n ? (out.push(n), out) : undefined
}
const sameVal = (x: unknown, y: unknown): boolean => {
  if (Object.is(x, y)) return true
  if (Array.isArray(x)) return Array.isArray(y) && x.length === y.length && x.every((v, i) => sameVal(v, y[i]))
  const hx = hostOf(x)
  const hy = hostOf(y)
  return !!hx && !!hy && sameHost(hx, hy)
}
const sameHost = (a: HostDescriptor, b: HostDescriptor): boolean => {
  if (a._ht !== b._ht || a._hk !== b._hk) return false
  const ka = Object.keys(a._hp)
  if (ka.length !== Object.keys(b._hp).length) return false
  return ka.every((k) => Object.hasOwn(b._hp, k) && sameVal(a._hp[k], b._hp[k]))
}
hostBuilder.build = hostNode
hostBuilder.same = sameHost

export const jsx = (type: string | ((props: any) => Element), props: Props, key?: string | number): Element => {
  const k = key ?? props.key
  const ks = k == null ? undefined : String(k)
  return typeof type === 'function'
    ? type === Fragment || type === Provider || type === Boundary
      ? type(props as any)
      : (instance(type, props, ks) as Element)
    : tagHost(element(type, props, ks), type, props, ks)
}
const tagHost = (e: Effect.Effect<Node, any, any>, type: string, props: Props, key: string | undefined): Element => {
  const h = e as unknown as { _ht: string; _hp: Props; _hk: string | undefined }
  h._ht = type
  h._hp = props
  h._hk = key
  return e as Element
}
export const jsxs = jsx

export const Fragment = (props: { children?: Child }): Element =>
  Effect.map(renderChildren(props.children), (kids) => fragment(...kids)) as Element

/** `<Provider layer={L}>…</Provider>`: JSX form of `Provide`. */
export const Provider = (props: { layer: Layer.Layer<any, any, never>; children?: Child }): Element =>
  Effect.flatMap(RenderScope, (scope) =>
    scope ? Effect.flatMap(Layer.buildWithScope(props.layer, scope), (ctx) => Effect.provide(Fragment(props), ctx)) : Effect.provide(Fragment(props), props.layer),
  ) as Element

/** `<Boundary tag="X" fallback={(e: X) => …}>…</Boundary>`: JSX form of `Catch`; handles only that tag. */
export const Boundary = <E extends { readonly _tag: string }>(props: {
  tag: E['_tag']
  fallback: (error: E) => Element
  children?: Child
}): Element =>
  Effect.catchTag(
    Effect.flatMap(Handlers, (hs) => Effect.provideService(Fragment(props), Handlers, [...hs, { tag: props.tag, fallback: props.fallback }])) as Effect.Effect<Node, { _tag: string }>,
    props.tag,
    (e) => props.fallback(e as unknown as E),
  ) as Element

export declare namespace JSX {
  type Element = Effect.Effect<Node, never, never>
  type ElementType = string | ((props: any) => Effect.Effect<Node, any, any>)
  interface ElementChildrenAttribute {
    children: {}
  }
  /** `key` is accepted on every element and component; the renderer reads it, components never see it. */
  interface IntrinsicAttributes {
    key?: string | number
  }
  interface IntrinsicElements {
    [tag: string]: Props
  }
}
