import { el, fragment, type Node } from '@sleekstack/ui'
import { Effect } from 'effect'

// An article body as ui nodes: headings, paragraphs, fenced code, flat lists, and inline code, strong, emphasis and links.
// ui has no raw-HTML node, so any HTML in the body is text by construction.

type Inline = Node | string

// `el` and `fragment` take their children as arguments, and spreading ~100k of them overflows the stack: a long list goes
// under nested fragments of at most SPREAD_MAX, which add no element.
const SPREAD_MAX = 5_000
const group = (items: Array<Inline>): Array<Inline> => {
  if (items.length <= SPREAD_MAX) return items
  const groups: Array<Inline> = []
  for (let i = 0; i < items.length; i += SPREAD_MAX) groups.push(fragment(...items.slice(i, i + SPREAD_MAX)))
  return group(groups)
}

/** A link target the browser may follow: relative, or `http:`, `https:` or `mailto:`. */
const safeHref = (url: string) => {
  const scheme = /^([^/?#]*?):/.exec(url)?.[1]
  return scheme === undefined || ['http', 'https', 'mailto'].includes(scheme.toLowerCase())
}

// `**strong**` may hold `*em*` and `*em*` may hold `**strong**`, one level deep; likewise with `_`.
const delimited = (d: string) => ({
  strong: new RegExp(`^${d}${d}((?:${d}[^${d}]+${d}|[^${d}])+)${d}${d}`),
  em: new RegExp(`^${d}((?:${d}${d}[^${d}]+${d}${d}|[^${d}])+)${d}`),
})
const STARS = delimited('\\*')
const UNDERSCORES = delimited('_')
const CODE = /^`([^`]+)`/
// A label holds no bracket and a target no parenthesis, so a failed match stops at the next one: linear on malformed input.
const LINK = /^\[([^[\]]+)\]\(([^()\s]+)\)/

const inline = (source: string): Array<Inline> => {
  const out: Array<Inline> = []
  let text = ''
  const push = (node: Node) => {
    if (text) out.push(text)
    text = ''
    out.push(node)
  }
  let i = 0
  while (i < source.length) {
    const rest = source.slice(i)
    // `_` delimits only at a word start, so `snake_case_name` stays as it is.
    const d = rest[0] === '*' ? STARS : rest[0] === '_' && !/\w/.test(source[i - 1] ?? '') ? UNDERSCORES : undefined
    let m: RegExpExecArray | null
    if ((m = CODE.exec(rest))) push(el('code', {}, m[1]!))
    else if ((m = LINK.exec(rest)))
      // An unsafe target (`javascript:`) keeps its label as text and loses the link.
      safeHref(m[2]!)
        ? push(el('a', { href: m[2]! }, ...group(inline(m[1]!))))
        : push(fragment(...group(inline(m[1]!))))
    else if (d && (m = d.strong.exec(rest))) push(el('strong', {}, ...group(inline(m[1]!))))
    else if (d && (m = d.em.exec(rest))) push(el('em', {}, ...group(inline(m[1]!))))
    else {
      text += source[i]
      i++
      continue
    }
    i += m[0].length
  }
  if (text) out.push(text)
  return out
}

const FENCE = /^```/
const HEADING = /^#{1,6}\s/
/** An ATX heading's level and text, without its closing `#`s. Plain string work: no regex backtracks on its spaces. */
const heading = (line: string) => {
  const level = line.search(/[^#]/)
  let text = line.slice(level).trimEnd()
  let end = text.length
  while (end > 0 && text[end - 1] === '#') end--
  if (end < text.length && /\s/.test(text[end - 1] ?? ' ')) text = text.slice(0, end)
  return { level, text: text.trim() }
}
const ITEM = /^\s*(?:[-*+]|\d+[.)])\s+/
const ORDERED = /^\s*\d/
const startsBlock = (line: string) => FENCE.test(line) || HEADING.test(line) || ITEM.test(line)

const blocks = (source: string): Array<Node> => {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const out: Array<Node> = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (!line.trim()) {
      i++
    } else if (FENCE.test(line)) {
      const code: Array<string> = []
      for (i++; i < lines.length && !FENCE.test(lines[i]!); i++) code.push(lines[i]!)
      i++
      out.push(el('pre', {}, el('code', {}, code.join('\n'))))
    } else if (HEADING.test(line)) {
      const { level, text } = heading(line)
      out.push(el(`h${level}`, {}, ...group(inline(text))))
      i++
    } else if (ITEM.test(line)) {
      const ordered = ORDERED.test(line)
      const items: Array<Node> = []
      for (; i < lines.length && ITEM.test(lines[i]!) && ORDERED.test(lines[i]!) === ordered; i++)
        items.push(el('li', {}, ...group(inline(lines[i]!.replace(ITEM, '')))))
      out.push(el(ordered ? 'ol' : 'ul', {}, ...group(items)))
    } else {
      const para: Array<string> = []
      for (; i < lines.length && lines[i]!.trim() && !startsBlock(lines[i]!); i++) para.push(lines[i]!.trim())
      out.push(el('p', {}, ...group(inline(para.join('\n')))))
    }
  }
  return out
}

/** The body as ui nodes, ready to place as a JSX child. */
export const markdown = (source: string): Effect.Effect<Node> => Effect.succeed(fragment(...group(blocks(source))))
