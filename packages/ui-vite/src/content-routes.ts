import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

export type ContentPage = {
  /** Absolute path of the content file. */
  file: string
  /** Route name: the slug, `index` for the root page. */
  name: string
  /** URL path including the base prefix. */
  path: string
}

export type ContentRouteOptions = {
  /** Prefix for every route, such as `/docs`. Default: none. */
  base?: string
}

const slugOf = (dir: string, file: string) =>
  relative(dir, file)
    .split(sep)
    .join('/')
    .replace(/\.mdx?$/, '')
    .replace(/(^|\/)index$/, '')

const files = (dir: string) =>
  readdirSync(dir, { recursive: true })
    .map((f) => join(dir, String(f)))
    .filter((f) => /\.mdx?$/.test(f))

/** The order file's `pages` entries: a slug or a directory name; unlisted pages follow, sorted by slug. */
const orderOf = (dir: string): string[] => {
  try {
    return JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')).pages ?? []
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw new Error(`${join(dir, 'meta.json')}: ${(e as Error).message}`, { cause: e })
  }
}

/** The pages of a content tree in the order file's order (`meta.json` next to the root, as fumadocs reads it). */
export const scanPages = (dir: string, { base = '' }: ContentRouteOptions = {}): ContentPage[] => {
  const prefix = base.replace(/\/$/, '')
  const all = files(dir)
    .map((file) => ({ file, slug: slugOf(dir, file) }))
    .sort((a, b) => a.slug.localeCompare(b.slug))
  const rank = (slug: string) => {
    const top = slug === '' ? 'index' : slug
    const at = orderOf(dir).findIndex((p) => top === p || top.startsWith(`${p}/`))
    return at === -1 ? Infinity : at
  }
  return all
    .map((p, i) => ({ ...p, i }))
    .sort((a, b) => rank(a.slug) - rank(b.slug) || a.i - b.i)
    .map(({ file, slug }) => ({ file, name: slug || 'index', path: `${prefix}/${slug}`.replace(/\/$/, '') || '/' }))
}

/** The route table for `@sleekstack/router`: route name to path. */
export const contentRouteTable = (pages: readonly ContentPage[]): Record<string, string> =>
  Object.fromEntries(pages.map((p) => [p.name, p.path]))
