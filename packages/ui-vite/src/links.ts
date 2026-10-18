import { readFileSync } from 'node:fs'
import { posix, relative } from 'node:path'
import GithubSlugger from 'github-slugger'
import type { Page } from './routes.js'

export type BrokenLink = { file: string; link: string }

const stripCode = (text: string) => text.replace(/```[\s\S]*?```/g, '')

/** Heading ids as the MDX pipeline renders them: github-slugger over the plain heading text, in page order. */
export const headingIds = (text: string): string[] => {
  const slugger = new GithubSlugger()
  return [...stripCode(text).matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)].map(([, raw]) =>
    slugger.slug(raw!.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`*_]/g, '')),
  )
}

// Inline links, reference definitions and href attributes.
const LINK = /\]\(([^)\s]+)[^)]*\)|^\s*\[[^\]]+\]:\s*(\S+)|href=["']([^"']+)["']/gm

/** Internal links in `pages` that resolve to no page, or to no heading on it. `file` is relative to `root`. */
export const findBrokenLinks = (pages: readonly Page[], root: string): BrokenLink[] => {
  const texts = pages.map((p) => readFileSync(p.file, 'utf8'))
  const ids = new Map(pages.map((p, i) => [p.path, new Set(headingIds(texts[i]!))]))
  const broken: BrokenLink[] = []
  pages.forEach((page, i) => {
    for (const m of stripCode(texts[i]!).matchAll(LINK)) {
      const raw = (m[1] ?? m[2] ?? m[3])!
      if (/^([a-z]+:|\/\/)/i.test(raw)) continue
      const [path, hash] = raw.split('#') as [string, string | undefined]
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
export const assertLinks = (pages: readonly Page[], root: string): void => {
  const broken = findBrokenLinks(pages, root)
  if (broken.length)
    throw new Error(`broken internal links:\n${broken.map((b) => `  ${b.file} -> ${b.link}`).join('\n')}`)
}
