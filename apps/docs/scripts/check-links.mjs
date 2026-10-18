// Fails on internal links in content/docs that do not resolve to a page (or to a heading on it).
// The build runs the same check under its own base prefix; this one reads the content as written (`/docs/...`).
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_CONTENT_BASE, findBrokenLinks as find, headings } from '@sleekstack/ui-vite/links'
import { scanPages } from '@sleekstack/ui-vite/content-routes'

export { headings }

export const contentDir = join(dirname(fileURLToPath(import.meta.url)), '../content/docs')

/** @returns {{ file: string, link: string }[]} */
export const findBrokenLinks = (dir = contentDir) => find(scanPages(dir, { base: DEFAULT_CONTENT_BASE }), dir)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const broken = findBrokenLinks()
  for (const b of broken) console.error(`broken link in ${b.file}: ${b.link}`)
  if (broken.length) process.exit(1)
  console.log('check:links: ok')
}
