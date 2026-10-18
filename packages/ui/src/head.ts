import { Cause, Context, Effect } from 'effect'
import { type Child, Fragment } from './jsx-runtime'
import { fragment, type Node } from './node'
import { Frame, MountError, useEffect } from './reactive'
import { checkAttr, checkTag } from './string'

/** One `Head` tag, validated. Tags with the same `key` replace each other; a tag with no key stands alone. */
export interface HeadTag {
  readonly key: string | undefined
  readonly tag: 'title' | 'meta' | 'link'
  readonly attrs: Readonly<Record<string, string>>
  readonly text: string
}

/** Where `Head` tags go: `add` registers one `Head`'s tags at its instance depth and returns their removal. */
export interface HeadTarget {
  readonly add: (tags: ReadonlyArray<HeadTag>, depth: number) => () => void
}

/** The render's head collector; unset, a mounted `Head` patches `document.head`. */
export class HeadSink extends Context.Reference<HeadSink>()('@sleekstack/ui/HeadSink', {
  defaultValue: (): HeadTarget | undefined => undefined,
}) {}

const HEAD_TAGS = new Set(['title', 'meta', 'link'])

const keyOf = (tag: HeadTag['tag'], a: Readonly<Record<string, string>>): string | undefined =>
  tag === 'title'
    ? 'title'
    : tag === 'meta'
      ? a.name !== undefined
        ? JSON.stringify(['meta', 'name', a.name])
        : a.property !== undefined
          ? JSON.stringify(['meta', 'property', a.property])
          : undefined
      : a.rel !== undefined && a.href !== undefined
        ? JSON.stringify(['link', a.rel, a.href])
        : undefined

// Same name and attribute policy as an element, plus: only title/meta/link, static attributes, text content.
const headTag = (node: Node): HeadTag => {
  if (node._tag !== 'Element') throw new TypeError(`Head takes title, meta and link elements, not ${node._tag}`)
  const tag = checkTag(node.tag).toLowerCase()
  if (!HEAD_TAGS.has(tag)) throw new TypeError(`Unsupported head tag: ${JSON.stringify(node.tag)}`)
  if (node.bound || node.on || node.events) throw new TypeError(`Head tags take plain attributes: <${tag}>`)
  for (const [k, v] of Object.entries(node.attrs)) checkAttr(k, v)
  const text = node.children
    .map((c) => {
      if (c._tag !== 'Text') throw new TypeError(`Head tags take text content only: <${tag}>`)
      return c.text
    })
    .join('')
  const t = tag as HeadTag['tag']
  return { key: keyOf(t, node.attrs), tag: t, attrs: node.attrs, text }
}

const flatten = (n: Node): ReadonlyArray<Node> => (n._tag === 'Fragment' ? n.children.flatMap(flatten) : [n])

interface Entry {
  readonly tag: HeadTag
  readonly depth: number
}

const documents = new WeakMap<Document, HeadTarget>()
/** One keyed patch of `doc.head` per document: each key owns one element, showing its deepest entry (last mounted on a tie). */
const documentHead = (doc: Document): HeadTarget => {
  const known = documents.get(doc)
  if (known) return known
  const entries = new Map<string, Array<Entry>>()
  const owned = new Map<string, Element>()
  let unkeyed = 0
  const patch = (key: string): void => {
    const list = entries.get(key)!
    const win = list.reduce<Entry | undefined>((w, e) => (w && w.depth > e.depth ? w : e), undefined)
    let el = owned.get(key)
    if (!win) {
      el?.remove()
      owned.delete(key)
      entries.delete(key)
      return
    }
    if (!el) {
      el = doc.createElement(win.tag.tag)
      doc.head.append(el)
      owned.set(key, el)
    }
    const { attrs, text } = win.tag
    for (const name of el.getAttributeNames()) if (!Object.hasOwn(attrs, name)) el.removeAttribute(name)
    for (const [k, v] of Object.entries(attrs)) if (el.getAttribute(k) !== v) el.setAttribute(k, v)
    if (el.textContent !== text) el.textContent = text
  }
  const target: HeadTarget = {
    add: (tags, depth) => {
      const added = tags.map((tag) => {
        const key = tag.key ?? `#${unkeyed++}`
        const entry = { tag, depth }
        let list = entries.get(key)
        if (!list) entries.set(key, (list = []))
        list.push(entry)
        return [key, entry] as const
      })
      for (const [key] of added) patch(key)
      return () => {
        for (const [key, entry] of added) {
          const list = entries.get(key)!
          list.splice(list.indexOf(entry), 1)
          patch(key)
        }
      }
    },
  }
  documents.set(doc, target)
  return target
}

/**
 * `<Head>…</Head>`: `title`, `meta` and `link` tags for the document head. Tags dedupe by key (`title`, `meta[name]`,
 * `meta[property]`, `link[rel]+href`): the deepest `Head` wins, the last mounted on a tie; a `Head`'s tags are removed when
 * it unmounts, uncovering the entries below. A tag that fails the element name and attribute checks is skipped and reported to `onError`.
 */
export const Head = (props: { children?: Child }): Effect.Effect<Node, never, never> =>
  Effect.flatMap(Effect.all([Fragment(props), Effect.context<never>()]), ([content, ctx]) => {
    const depth = Context.get(ctx, Frame)?.depth ?? 0
    const sink = Context.get(ctx, HeadSink)
    const report = Context.get(ctx, MountError)
    const tags: Array<HeadTag> = []
    const errors: Array<unknown> = []
    for (const n of flatten(content))
      try {
        tags.push(headTag(n))
      } catch (error) {
        errors.push(error)
      }
    // Registered after commit (mount only); unchanged content keeps its entries, so a re-run neither flickers nor reloads a link.
    return Effect.as(
      useEffect(() => {
        for (const e of errors) report?.(Cause.die(e))
        return (sink ?? documentHead(document)).add(tags, depth)
      }, [JSON.stringify([tags, errors.map(String)])]),
      fragment(),
    )
  }) as Effect.Effect<Node, never, never>
