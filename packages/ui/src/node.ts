import type { Atom } from '@sleekstack/core'
import type { Context, Effect, Scope } from 'effect'
import type { ComponentType } from 'react'
import type { ActionEvent, Handler } from './handler'
import type { RunFrame } from './reactive'

export interface TextNode {
  readonly _tag: 'Text'
  readonly text: string
}
export interface ElementNode {
  readonly _tag: 'Element'
  readonly tag: string
  readonly attrs: Readonly<Record<string, string>>
  readonly children: ReadonlyArray<Node>
  /** Event name to handler; rendered as `data-sleek-on-<event>` by `renderToString`, ignored by `mount`. */
  readonly on?: Readonly<Record<string, Handler<any, any, any>>>
  /** Event name to closure binding, from function-valued `onXxx` JSX props; ignored by `renderToString`. */
  readonly events?: Readonly<Record<string, EventBinding>>
  readonly key?: string
  /** From a host element's `ref` prop: set to the DOM element once it is attached, and to `null` when it is removed. */
  readonly ref?: Ref<any>
  /** Attribute name to atom, from atom-valued JSX props: set from the atom's value and kept current without re-running the component. */
  readonly bound?: Readonly<Record<string, Atom.Atom<any>>>
}
/** What `useRef` returns and a host element's `ref` prop takes. */
export interface Ref<in out T> {
  current: T | null
}
/** A JSX event closure and the context captured while its element's JSX Effect ran. */
export interface EventBinding {
  readonly run: (event: Event) => Effect.Effect<void, never, any>
  readonly context: Context.Context<any>
  /** A form's `action`: run after `run` on submit with the form's data; the default is prevented and the latest submit wins. */
  readonly action?: (event: ActionEvent) => Effect.Effect<void, never, any>
}
export interface FragmentNode {
  readonly _tag: 'Fragment'
  readonly children: ReadonlyArray<Node>
}
export interface GuestNode {
  readonly _tag: 'Guest'
  readonly component: ComponentType<any>
  readonly props: object
  readonly key?: string
}
/** A component instance that read atoms: `child` is its last render, `rerun` renders it again in its captured context. */
export interface ReactiveNode {
  readonly _tag: 'Reactive'
  readonly atoms: ReadonlyArray<Atom.Atom<any>>
  readonly child: Node
  readonly rerun: Effect.Effect<Node>
  /** @internal The values `atoms` had when read, in order; a change before subscribing re-runs. */
  readonly seen?: ReadonlyArray<unknown>
  /** @internal This run's `RenderScope` child; closed by the renderer when the run's DOM is replaced or dropped. */
  readonly scope?: Scope.CloseableScope
  readonly key?: string
  /** @internal This run's frame; the renderer commits or drops its pending child slots, and a kill disposes its slots. */
  readonly frame?: RunFrame
  /** @internal Instance identity, `<fnId>#<ordinal>` or `<fnId>:key:<key>`; set by `instance`. */
  readonly id: string
  /**
   * @internal Set on a `Pending` instance: its `fallback` and `content` children as written. `frame` is set when `child`
   * is resolved content; that content's slots commit with it, and its scopes belong to the `Pending` until committed.
   */
  readonly pending?: { readonly fallback: unknown; readonly content: unknown; readonly frame?: RunFrame }
}
/** An atom's current value as text, bound under the atom's serializable key for resume. */
export interface BindNode {
  readonly _tag: 'Bind'
  readonly atom: Atom.Atom<any>
  /** Any atom (derived, not serializable): live text on the client, plain text in `renderToString`, never resumed. */
  readonly plain?: true
}
export type Node = TextNode | ElementNode | FragmentNode | GuestNode | ReactiveNode | BindNode

const toNode = (c: Node | string): Node => (typeof c === 'string' ? { _tag: 'Text', text: c } : c)

/** Builds an element node. String children become text nodes. */
export const el = (tag: string, attrs: Record<string, string> = {}, ...children: Array<Node | string>): Node => ({
  _tag: 'Element',
  tag,
  attrs: { ...attrs },
  children: children.map(toNode),
})

/** Groups children without a wrapping element. */
export const fragment = (...children: Array<Node | string>): Node => ({
  _tag: 'Fragment',
  children: children.map(toNode),
})
