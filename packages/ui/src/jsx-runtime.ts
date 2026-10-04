import { type Context, Effect, Layer } from 'effect'
import { el, type ElementNode, type EventBinding, fragment, type Node } from './node'
import { Handlers, instance, RenderScope } from './reactive'

/** What a JSX expression may hold between its tags. */
export type Child = string | number | boolean | null | undefined | Effect.Effect<Node, any, any> | ReadonlyArray<Child>

/** Every JSX expression is an `Effect<Node>`. Its requirements and errors are read from the tree by `sleekstack check`, not by tsc. */
type Element = Effect.Effect<Node, never, never>
type Props = Record<string, unknown> & { children?: Child }

const rendered = (c: Child): Array<Effect.Effect<Node | string, any, any>> =>
  Array.isArray(c)
    ? c.flatMap(rendered)
    : c == null || typeof c === 'boolean'
      ? []
      : [Effect.isEffect(c) ? c : Effect.succeed(String(c))]

const renderChildren = (c: Child) => Effect.all(rendered(c)) as Effect.Effect<Array<Node | string>>

// Attributes are strings in the Node tree: `className` / `htmlFor` map to `class` / `for`, `true` is an empty value, nullish and `false` are dropped.
const RENAME: Record<string, string> = { className: 'class', htmlFor: 'for' }
const attrs = (props: Props): Record<string, string> =>
  Object.fromEntries(
    Object.entries(props).flatMap(([k, v]) =>
      k === 'children' || k === 'key' || isEvent(k, v) || v == null || v === false ? [] : [[RENAME[k] ?? k, v === true ? '' : String(v)]],
    ),
  )

// A function-valued `onXxx` prop is an event closure, not an attribute; non-function `on*` still reaches `checkAttr`.
const isEvent = (k: string, v: unknown): v is EventBinding['run'] => typeof v === 'function' && /^on[A-Z]/.test(k)
const events = (props: Props, context: Context.Context<any>): Record<string, EventBinding> | undefined => {
  const entries = Object.entries(props).flatMap(([k, v]) => (isEvent(k, v) ? [[k.slice(2).toLowerCase(), { run: v, context }]] : []))
  return entries.length ? Object.fromEntries(entries) : undefined
}

const element = (type: string, props: Props, key: string | undefined): Effect.Effect<Node, any, any> =>
  Effect.flatMap(Effect.context<any>(), (ctx) =>
    Effect.map(renderChildren(props.children), (kids) => {
      const node = el(type, attrs(props), ...kids) as ElementNode
      const evs = events(props, ctx)
      return { ...node, ...(evs && { events: evs }), ...(key !== undefined && { key }) }
    }),
  )

export const jsx = (type: string | ((props: any) => Element), props: Props, key?: string | number): Element => {
  const k = key ?? props.key
  const ks = k == null ? undefined : String(k)
  return typeof type === 'function'
    ? type === Fragment || type === Provider || type === Boundary
      ? type(props as any)
      : (instance(type, props, ks) as Element)
    : (element(type, props, ks) as Element)
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
  interface IntrinsicElements {
    [tag: string]: Props
  }
}
