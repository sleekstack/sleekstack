// Fails on internal links in content/docs that do not resolve to a page.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, posix, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const contentDir = join(dirname(fileURLToPath(import.meta.url)), '../content/docs')

const toRoute = (dir, file) => {
  const slug = relative(dir, file).split('\\').join('/').replace(/\.mdx?$/, '').replace(/(^|\/)index$/, '')
  return slug ? `/docs/${slug}` : '/docs'
}

/** @returns {{ file: string, link: string }[]} */
export function findBrokenLinks(dir = contentDir) {
  const files = readdirSync(dir, { recursive: true })
    .map((f) => join(dir, String(f)))
    .filter((f) => /\.mdx?$/.test(f))
  const routes = new Set(files.map((f) => toRoute(dir, f)))
  const broken = []
  for (const file of files) {
    const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '')
    for (const [, raw] of text.matchAll(/\]\(([^)\s]+)[^)]*\)|href=["']([^"']+)["']/g).map((m) => [m, m[1] ?? m[2]])) {
      if (/^([a-z]+:|#|\/\/)/i.test(raw)) continue
      const path = raw.split('#')[0].replace(/\/(index)?$/, '')
      const route = path.startsWith('/') ? path : posix.join(/(^|[\\/])index\.mdx?$/.test(file) ? toRoute(dir, file) : posix.dirname(toRoute(dir, file)), path)
      if (!routes.has(route)) broken.push({ file: relative(dir, file), link: raw })
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
