// Fails on internal links in content/docs that do not resolve to a page (or to a heading on it).
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, posix, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import GithubSlugger from 'github-slugger'

export const contentDir = join(dirname(fileURLToPath(import.meta.url)), '../content/docs')

const stripCode = (text) => text.replace(/```[\s\S]*?```/g, '')

/** Heading ids as Fumadocs renders them (github-slugger over the heading text, in page order). */
export function headings(text) {
  const slugger = new GithubSlugger()
  return [...stripCode(text).matchAll(/^(#{1,6})\s+(.+?)\s*#*$/gm)].map(([, hashes, raw]) => {
    const plain = raw.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`*_]/g, '')
    return { depth: hashes.length, text: plain, id: slugger.slug(plain) }
  })
}

const toRoute = (dir, file) => {
  const slug = relative(dir, file)
    .split('\\')
    .join('/')
    .replace(/\.mdx?$/, '')
    .replace(/(^|\/)index$/, '')
  return slug ? `/docs/${slug}` : '/docs'
}

// Inline links, reference definitions and href attributes.
const LINK = /\]\(([^)\s]+)[^)]*\)|^\s*\[[^\]]+\]:\s*(\S+)|href=["']([^"']+)["']/gm

/** @returns {{ file: string, link: string }[]} */
export function findBrokenLinks(dir = contentDir) {
  const files = readdirSync(dir, { recursive: true })
    .map((f) => join(dir, String(f)))
    .filter((f) => /\.mdx?$/.test(f))
  const pages = new Map(
    files.map((f) => [toRoute(dir, f), new Set(headings(readFileSync(f, 'utf8')).map((h) => h.id))]),
  )
  const broken = []
  for (const file of files) {
    const self = toRoute(dir, file)
    for (const m of stripCode(readFileSync(file, 'utf8')).matchAll(LINK)) {
      const raw = m[1] ?? m[2] ?? m[3]
      if (/^([a-z]+:|\/\/)/i.test(raw)) continue
      const [path, hash] = raw.split('#')
      // Browser semantics: a relative link resolves against the page URL's directory, so on
      // /docs (the index page) `./concepts` is /concepts, not /docs/concepts.
      const base = posix.dirname(self)
      const route = !path
        ? self
        : path.startsWith('/')
          ? path.replace(/\/$/, '')
          : posix.join(base, path).replace(/\/$/, '')
      const ids = pages.get(route)
      if (!ids || (hash && !ids.has(hash))) broken.push({ file: relative(dir, file), link: raw })
    }
  }
  return broken
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const broken = findBrokenLinks()
  for (const b of broken) console.error(`broken link in ${b.file}: ${b.link}`)
  if (broken.length) process.exit(1)
  console.log('check:links: ok')
}
