import { Effect, type Layer } from 'effect'
import { el, fragment, type Node } from './node'

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
      k === 'children' || k === 'key' || v == null || v === false ? [] : [[RENAME[k] ?? k, v === true ? '' : String(v)]],
    ),
  )

export const jsx = (type: string | ((props: any) => Element), props: Props): Element =>
  typeof type === 'function'
    ? type(props)
    : (Effect.map(renderChildren(props.children), (kids) => el(type, attrs(props), ...kids)) as Element)
export const jsxs = jsx

export const Fragment = (props: { children?: Child }): Element =>
  Effect.map(renderChildren(props.children), (kids) => fragment(...kids)) as Element

/** `<Provider layer={L}>…</Provider>`: JSX form of `Provide`. */
export const Provider = (props: { layer: Layer.Layer<any, any, never>; children?: Child }): Element =>
  Effect.provide(Fragment(props), props.layer) as Element

/** `<Boundary tag="X" fallback={(e: X) => …}>…</Boundary>`: JSX form of `Catch`; handles only that tag. */
export const Boundary = <E extends { readonly _tag: string }>(props: {
  tag: E['_tag']
  fallback: (error: E) => Element
  children?: Child
}): Element =>
  Effect.catchTag(Fragment(props) as Effect.Effect<Node, { _tag: string }>, props.tag, (e) => props.fallback(e as unknown as E)) as Element

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
