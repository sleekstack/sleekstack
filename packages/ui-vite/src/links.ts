import { readFileSync } from 'node:fs'
import { posix, relative } from 'node:path'
import GithubSlugger from 'github-slugger'
import type { Root } from 'mdast'
import { visit } from 'unist-util-visit'
import type { Page } from './routes.js'

export type BrokenLink = { file: string; link: string }

/** The prefix content links are written with unless a build says otherwise. */
export const DEFAULT_CONTENT_BASE = '/docs'

/** Internal links starting with `from` are served under `to`. */
export type Rebase = { from: string; to: string }

/** `url` with a leading `from` (a whole path segment) swapped for `to`; any other link is returned as is. */
export const rebaseLink = (url: string, { from, to }: Rebase): string => {
  if (!(url === from || [`${from}/`, `${from}#`, `${from}?`].some((p) => url.startsWith(p)))) return url
  const out = to.replace(/\/$/, '') + url.slice(from.length)
  return out.startsWith('/') ? out : `/${out}`
}

/** Rewrites the content's links (`[](/docs/x)`, reference definitions, `href` attributes) with `rebaseLink`. */
export const remarkRebase = (rebase: Rebase) => () => (tree: Root) => {
  visit(tree, (node) => {
    if (node.type === 'link' || node.type === 'definition') node.url = rebaseLink(node.url, rebase)
    else if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement')
      for (const a of node.attributes)
        if (a.type === 'mdxJsxAttribute' && a.name === 'href' && typeof a.value === 'string')
          a.value = rebaseLink(a.value, rebase)
  })
}

const stripCode = (text: string) => text.replace(/```[\s\S]*?```/g, '')

export type Heading = { depth: number; text: string; id: string }

/**
 * The headings of a page as the MDX pipeline renders them: github-slugger over the plain heading text, in page order.
 * An underscore is dropped only where it marks emphasis (`_x_`); `_tag` and `snake_case` keep theirs, as in rehype-slug.
 */
export const headings = (text: string): Heading[] => {
  const slugger = new GithubSlugger()
  return [...stripCode(text).matchAll(/^(#{1,6})\s+(.+?)\s*#*$/gm)].map(([, hashes, raw]) => {
    const plain = raw!
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[`*]/g, '')
      .replace(/(^|\W)_([^_]+)_(?!\w)/g, '$1$2')
    return { depth: hashes!.length, text: plain, id: slugger.slug(plain) }
  })
}

export const headingIds = (text: string): string[] => headings(text).map((h) => h.id)

// Inline links, reference definitions and href attributes.
const LINK = /\]\(([^)\s]+)[^)]*\)|^\s*\[[^\]]+\]:\s*(\S+)|href=["']([^"']+)["']/gm

/** Internal links in `pages` that resolve to no page, or to no heading on it. `file` is relative to `root`. */
export const findBrokenLinks = (pages: readonly Page[], root: string, rebase?: Rebase): BrokenLink[] => {
  const texts = pages.map((p) => readFileSync(p.file, 'utf8'))
  const ids = new Map(pages.map((p, i) => [p.path, new Set(headingIds(texts[i]!))]))
  const broken: BrokenLink[] = []
  pages.forEach((page, i) => {
    for (const m of stripCode(texts[i]!).matchAll(LINK)) {
      const raw = (m[1] ?? m[2] ?? m[3])!
      if (/^([a-z]+:|\/\/)/i.test(raw)) continue
      const [path, hash] = (rebase ? rebaseLink(raw, rebase) : raw).split('#') as [string, string | undefined]
      // A relative link resolves against the page URL's directory, as in a browser.
      const route = !path
        ? page.path
        : (path.startsWith('/') ? path : posix.join(posix.dirname(page.path), path)).replace(/(.)\/$/, '$1')
      const target = ids.get(route)
      if (!target || (hash && !target.has(hash))) broken.push({ file: relative(root, page.file), link: raw })
    }
  })
  return broken
}

/** Throws one error naming every broken link by source and target. */
export const assertLinks = (pages: readonly Page[], root: string, rebase?: Rebase): void => {
  const broken = findBrokenLinks(pages, root, rebase)
  if (broken.length)
    throw new Error(`broken internal links:\n${broken.map((b) => `  ${b.file} -> ${b.link}`).join('\n')}`)
}
