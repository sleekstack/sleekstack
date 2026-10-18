import { Cause, Context, Effect } from 'effect'
import { type Child, Fragment } from './jsx-runtime'
import { fragment, type Node } from './node'
import { Frame, MountError, useEffect, useRef } from './reactive'
import { checkAttr, checkTag, headOf } from './string'

/** One `Head` tag, validated; attribute names are lowercase. Tags with the same `key` replace each other; a tag with no key stands alone. */
export interface HeadTag {
  readonly key: string | undefined
  readonly tag: string
  readonly attrs: Readonly<Record<string, string>>
  readonly text: string
}

/** One mounted `Head`'s place in the head: its tags are replaced by `set` and dropped by `remove`. */
export interface HeadEntry {
  readonly set: (tags: ReadonlyArray<HeadTag>) => void
  readonly remove: () => void
}

/** Where `Head` tags go: `add` registers one `Head` at its instance depth, in mount order. */
export interface HeadTarget {
  readonly add: (depth: number) => HeadEntry
}

/** The render's head collector: `mount` provides its container document's; unset, `Head` does nothing. */
export class HeadSink extends Context.Reference<HeadSink>()('@sleekstack/ui/HeadSink', {
  defaultValue: (): HeadTarget | undefined => undefined,
}) {}

const HEAD_TAGS = new Set(['title', 'meta', 'link'])

const keyOf = (tag: string, a: Readonly<Record<string, string>>): string | undefined =>
  tag === 'title'
    ? 'title'
    : tag === 'meta'
      ? a.name !== undefined
        ? JSON.stringify(['meta', 'name', a.name])
        : a.property !== undefined
          ? JSON.stringify(['meta', 'property', a.property])
          : undefined
      : tag === 'link' && a.rel !== undefined && a.href !== undefined
        ? JSON.stringify(['link', a.rel, a.href])
        : undefined

// Same name and attribute policy as an element, plus: only title/meta/link, static attributes, text content.
const headTag = (node: Node): HeadTag => {
  if (node._tag !== 'Element') throw new TypeError(`Head takes title, meta and link elements, not ${node._tag}`)
  const tag = checkTag(node.tag).toLowerCase()
  if (!HEAD_TAGS.has(tag)) throw new TypeError(`Unsupported head tag: ${JSON.stringify(node.tag)}`)
  if (node.bound || node.on || node.events) throw new TypeError(`Head tags take plain attributes: <${tag}>`)
  if (tag !== 'title' && node.children.length > 0) throw new TypeError(`<${tag}> takes no content`)
  const attrs: Record<string, string> = {}
  // HTML attribute names are case-insensitive: lowercase them so keys match what the DOM holds.
  for (const [k, v] of Object.entries(node.attrs)) (checkAttr(k, v), (attrs[k.toLowerCase()] = v))
  const text = node.children
    .map((c) => {
      if (c._tag !== 'Text') throw new TypeError(`Head tags take text content only: <${tag}>`)
      return c.text
    })
    .join('')
  return { key: keyOf(tag, attrs), tag, attrs, text }
}

const flatten = (n: Node): ReadonlyArray<Node> => (n._tag === 'Fragment' ? n.children.flatMap(flatten) : [n])

const attrsOf = (el: Element): Record<string, string> =>
  Object.fromEntries(el.getAttributeNames().map((n) => [n, el.getAttribute(n)!]))
const apply = (el: Element, attrs: Readonly<Record<string, string>>, text: string): void => {
  for (const name of el.getAttributeNames()) if (!Object.hasOwn(attrs, name)) el.removeAttribute(name)
  for (const [k, v] of Object.entries(attrs)) if (el.getAttribute(k) !== v) el.setAttribute(k, v)
  if (el.textContent !== text) el.textContent = text
}

interface Reg {
  readonly depth: number
  tags: ReadonlyArray<readonly [string, HeadTag]>
}
/** An element a key shows its winner in; `before` is the state of a tag the document already had, restored when the key empties. */
interface Slot {
  readonly el: Element
  readonly before?: { readonly attrs: Record<string, string>; readonly text: string }
}

const documents = new WeakMap<Document, HeadTarget>()
/**
 * The keyed patch of `doc.head`, one per document: each key shows its deepest tag, the last mounted on a tie. A key takes
 * over a matching tag the document already has (a shell `<title>`) and restores it when no `Head` holds the key.
 */
export const documentHead = (doc: Document): HeadTarget => {
  const known = documents.get(doc)
  if (known) return known
  // Insertion order is mount order.
  const regs = new Set<Reg>()
  const slots = new Map<string, Slot>()
  let unkeyed = 0
  const claim = (key: string, tag: string): Slot => {
    const taken = new Set([...slots.values()].map((s) => s.el))
    const found = [...doc.head.children].find(
      (el) => !taken.has(el) && el.localName === tag && keyOf(tag, attrsOf(el)) === key,
    )
    const slot: Slot = found
      ? { el: found, before: { attrs: attrsOf(found), text: found.textContent ?? '' } }
      : { el: doc.head.appendChild(doc.createElement(tag)) }
    slots.set(key, slot)
    return slot
  }
  const patch = (key: string): void => {
    let win: HeadTag | undefined
    let depth = -1
    for (const r of regs) for (const [k, t] of r.tags) if (k === key && r.depth >= depth) ((win = t), (depth = r.depth))
    const slot = slots.get(key)
    if (win) return apply((slot ?? claim(key, win.tag)).el, win.attrs, win.text)
    if (!slot) return
    slots.delete(key)
    if (slot.before) apply(slot.el, slot.before.attrs, slot.before.text)
    else slot.el.remove()
  }
  const target: HeadTarget = {
    add: (depth) => {
      const reg: Reg = { depth, tags: [] }
      regs.add(reg)
      const update = (tags: ReadonlyArray<readonly [string, HeadTag]>) => {
        const keys = new Set([...reg.tags, ...tags].map(([k]) => k))
        reg.tags = tags
        keys.forEach(patch)
      }
      return {
        set: (tags) => update(tags.map((t) => [t.key ?? `#${unkeyed++}`, t] as const)),
        remove: () => {
          regs.delete(reg)
          update([])
        },
      }
    },
  }
  documents.set(doc, target)
  return target
}

/**
 * `<Head>…</Head>`: `title`, `meta` and `link` tags for the document head. Tags dedupe by key (`title`, `meta[name]`,
 * `meta[property]`, `link[rel]+href`): the deepest `Head` wins, the last mounted on a tie; a `Head`'s tags are removed when
 * it unmounts, uncovering the entries below. A tag that fails the element name and attribute checks is skipped and reported to
 * `onError`; in `renderToString` and a stream's shell it rejects the render, like an invalid element. In a stream, a `Head`
 * inside `Pending` takes effect when its boundary resolves (ADR 0044).
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
    // A string or stream render reads the tags off the output node when it serializes it.
    const out = fragment()
    headOf.set(out, { depth, tags, errors })
    // Registered once, after the first commit (mount only), so the mount order stands; a run with new content updates it in place.
    return Effect.flatMap(useRef<HeadEntry>(), (entry) =>
      Effect.as(
        Effect.zipRight(
          useEffect(() => {
            for (const e of errors) report?.(Cause.die(e))
            if (sink) (entry.current ??= sink.add(depth)).set(tags)
          }, [JSON.stringify([tags, errors.map(String)])]),
          useEffect(() => () => entry.current?.remove(), []),
        ),
        out,
      ),
    )
  }) as Effect.Effect<Node, never, never>
