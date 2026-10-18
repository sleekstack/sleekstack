import { el, fragment, type Node } from '@sleekstack/ui'
import { Effect } from 'effect'

// An article body as ui nodes: headings, paragraphs, fenced code, flat lists, and inline code, strong, emphasis and links.
// ui has no raw-HTML node, so any HTML in the body is text by construction.

type Inline = Node | string

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
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)/

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
      safeHref(m[2]!) ? push(el('a', { href: m[2]! }, ...inline(m[1]!))) : push(fragment(...inline(m[1]!)))
    else if (d && (m = d.strong.exec(rest))) push(el('strong', {}, ...inline(m[1]!)))
    else if (d && (m = d.em.exec(rest))) push(el('em', {}, ...inline(m[1]!)))
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
const HEADING = /^(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/
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
      const [, hashes, text] = HEADING.exec(line)!
      out.push(el(`h${hashes!.length}`, {}, ...inline(text!)))
      i++
    } else if (ITEM.test(line)) {
      const ordered = ORDERED.test(line)
      const items: Array<Node> = []
      for (; i < lines.length && ITEM.test(lines[i]!) && ORDERED.test(lines[i]!) === ordered; i++)
        items.push(el('li', {}, ...inline(lines[i]!.replace(ITEM, ''))))
      out.push(el(ordered ? 'ol' : 'ul', {}, ...items))
    } else {
      const para: Array<string> = []
      for (; i < lines.length && lines[i]!.trim() && !startsBlock(lines[i]!); i++) para.push(lines[i]!.trim())
      out.push(el('p', {}, ...inline(para.join('\n'))))
    }
  }
  return out
}

/** The body as ui nodes, ready to place as a JSX child. */
export const markdown = (source: string): Effect.Effect<Node> => Effect.succeed(fragment(...blocks(source)))
