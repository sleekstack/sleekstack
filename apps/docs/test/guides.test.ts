import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contentDir } from '../scripts/check-links.mjs'
import { repoRoot } from '../scripts/entry-points.mjs'

const snippetsDir = join(contentDir, '../../snippets')
const guides = readdirSync(contentDir).filter((f) => f.endsWith('.mdx'))
const read = (f: string) => readFileSync(join(contentDir, f), 'utf8')

/** Absolute paths of every `<include>` in a guide, resolved as fumadocs-mdx does (relative to the file). */
const includesOf = (f: string) =>
  [...read(f).matchAll(/<include>([^<#]+)(?:#[^<]*)?<\/include>/g)].map((m) => resolve(contentDir, m[1]!.trim()))

const scope = [
  'index', 'getting-started-kit', 'getting-started-effect', 'concepts', 'kit-vs-effect',
  'nextjs', 'react', 'atoms', 'queries', 'queries-ssr', 'tanstack-query', 'side-effects', 'errors', 'testing', 'showcases',
]

describe('guides', () => {
  it('every Scope guide exists and is in the sidebar', () => {
    const pages: string[] = JSON.parse(read('meta.json')).pages
    for (const slug of scope) {
      expect(guides, slug).toContain(`${slug}.mdx`)
      expect(pages, slug).toContain(slug)
    }
  })

  it('have no inline code fences; code comes from includes', () => {
    expect(guides.filter((f) => /^\s*(```|~~~)/m.test(read(f)))).toEqual([])
  })

  it('include only existing snippet or showcase files', () => {
    const allowed = [snippetsDir, join(repoRoot, 'apps/showcase'), join(repoRoot, 'apps/showcase-kit')]
    const bad = guides.flatMap((f) =>
      includesOf(f)
        .filter((p) => !existsSync(p) || !allowed.some((dir) => !relative(dir, p).startsWith('..')))
        .map((p) => `${f}: ${relative(contentDir, p)}`),
    )
    expect(bad).toEqual([])
  })

  it('include every snippet file', () => {
    const used = new Set(guides.flatMap(includesOf))
    const snippets = readdirSync(snippetsDir, { recursive: true, encoding: 'utf8' })
      .filter((f) => /\.tsx?$/.test(f))
      .map((f) => join(snippetsDir, f))
    expect(snippets.filter((p) => !used.has(p)).map((p) => relative(dirname(snippetsDir), p))).toEqual([])
  })
})
