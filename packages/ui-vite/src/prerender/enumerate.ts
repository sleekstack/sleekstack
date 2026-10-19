/**
 * Which pages `vite build` prerenders. `true` prerenders every static route plus each dynamic route's `prerender()`
 * expansion; a list prerenders the listed paths plus those expansions. Off (the default) prerenders nothing.
 *
 * Paths are normalized without a trailing slash (`/docs/` is `/docs`, the root is `/`) and each is written to
 * `<path>/index.html`, so a static server answers both `/docs` and `/docs/`.
 */
export type PrerenderOption = true | readonly string[]

/** A route's param values to prerender, one object per page: `{ id: '1' }` for `/users/:id`. */
export type PrerenderParams = () => Promise<ReadonlyArray<Readonly<Record<string, string>>>>

/** The router's `{ table, pages }`; a page may declare `prerender()` to expand its route's `:param` segments. */
export interface PrerenderRoutes {
  readonly table: { readonly [name: string]: string }
  readonly pages: { readonly [name: string]: object & { readonly prerender?: PrerenderParams } }
}

/** The paths to prerender, deduplicated in discovery order, and a warning per dynamic route that was skipped. */
export interface Enumerated {
  readonly paths: readonly string[]
  readonly warnings: readonly string[]
}

const segments = (path: string) => path.replace(/^\/|\/$/g, '').split('/')

/** `/a/b/` and `a/b` are `/a/b`; `''` and `/` are `/`. */
export const normalizePath = (path: string) => `/${path.replace(/^\/+|\/+$/g, '')}`

const isDynamic = (path: string) => segments(path).some((s) => s.startsWith(':'))

/** Whether a concrete `path` fills route `pattern` (same segment count, statics equal, params non-empty). */
const fills = (pattern: string, path: string) => {
  const p = segments(pattern)
  const a = segments(path)
  return p.length === a.length && p.every((s, i) => (s.startsWith(':') ? a[i] !== '' : s === a[i]))
}

/**
 * Fills each `:param` of `path` from `params`, percent-encoded. Throws naming the route when a param is missing (not an
 * own non-empty string) or is `.` / `..`, which URL parsing would resolve to another path.
 */
const fill = (name: string, path: string, params: Readonly<Record<string, string>>) =>
  normalizePath(
    segments(path)
      .map((s) => {
        if (!s.startsWith(':')) return s
        const key = s.slice(1)
        const value: unknown = Object.hasOwn(params, key) ? params[key] : undefined
        const fail = (why: string) => new Error(`prerender: route '${name}' (${path}): prerender() ${why} '${key}'`)
        if (typeof value !== 'string' || value === '') throw fail('gave no')
        if (value === '.' || value === '..') throw fail(`gave '${value}' for`)
        return encodeURIComponent(value)
      })
      .join('/'),
  )

/** The union of `option` and every route's `prerender()` expansion. A dynamic route with neither is skipped with a warning. */
export const enumerate = async (routes: PrerenderRoutes, option: PrerenderOption | undefined): Promise<Enumerated> => {
  if (!option) return { paths: [], warnings: [] }
  const listed = option === true ? [] : option.map(normalizePath)
  const paths = new Set<string>()
  const warnings: string[] = []
  for (const [name, path] of Object.entries(routes.table)) {
    const expand = routes.pages[name]?.prerender
    if (!isDynamic(path)) {
      if (option === true) paths.add(normalizePath(path))
    } else if (expand) {
      let all: Awaited<ReturnType<PrerenderParams>>
      try {
        all = await expand()
      } catch (e) {
        throw new Error(`prerender: route '${name}' (${path}): prerender() failed: ${(e as Error).message}`, {
          cause: e,
        })
      }
      for (const params of all) paths.add(fill(name, path, params))
    } else if (!listed.some((l) => fills(path, l))) {
      warnings.push(`prerender: skipped dynamic route '${name}' (${path}): it has no prerender()`)
    }
  }
  for (const l of listed) paths.add(l)
  return { paths: [...paths], warnings }
}
