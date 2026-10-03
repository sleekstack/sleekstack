import type { Atom } from '@sleekstack/core'
import type { Effect, Scope } from 'effect'
import type { ComponentType } from 'react'

export interface TextNode {
  readonly _tag: 'Text'
  readonly text: string
}
export interface ElementNode {
  readonly _tag: 'Element'
  readonly tag: string
  readonly attrs: Readonly<Record<string, string>>
  readonly children: ReadonlyArray<Node>
}
export interface FragmentNode {
  readonly _tag: 'Fragment'
  readonly children: ReadonlyArray<Node>
}
export interface GuestNode {
  readonly _tag: 'Guest'
  readonly component: ComponentType<any>
  readonly props: object
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
}
export type Node = TextNode | ElementNode | FragmentNode | GuestNode | ReactiveNode

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
