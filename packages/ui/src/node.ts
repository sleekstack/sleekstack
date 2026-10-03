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
export type Node = TextNode | ElementNode | FragmentNode | GuestNode

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
