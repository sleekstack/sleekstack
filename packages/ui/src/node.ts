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

const TAG = /^[a-zA-Z][a-zA-Z0-9-]*$/
const ATTR = /^[^\s"'<>\/=\x00-\x1f]+$/

/** Builds an element node. String children become text nodes. Throws on an invalid tag or attribute name. */
export const el = (tag: string, attrs: Record<string, string> = {}, ...children: Array<Node | string>): Node => {
  if (!TAG.test(tag)) throw new TypeError(`Invalid tag name: ${JSON.stringify(tag)}`)
  for (const name of Object.keys(attrs))
    if (!ATTR.test(name)) throw new TypeError(`Invalid attribute name: ${JSON.stringify(name)}`)
  return { _tag: 'Element', tag, attrs: { ...attrs }, children: children.map(toNode) }
}

/** Groups children without a wrapping element. */
export const fragment = (...children: Array<Node | string>): Node => ({
  _tag: 'Fragment',
  children: children.map(toNode),
})
