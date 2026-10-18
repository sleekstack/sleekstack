/** The order file (`content/docs/meta.json`): the site title and the ordered page slugs; a slug that is a folder lists its pages. */
export interface OrderFile {
  readonly title: string
  readonly pages: ReadonlyArray<string>
}

/** A built page: its slug path under the docs root (`['api', 'core']`) and its title. */
export interface PageEntry {
  readonly slug: ReadonlyArray<string>
  readonly title: string
}

export type NavNode =
  | { readonly type: 'page'; readonly title: string; readonly url: string }
  | {
      readonly type: 'folder'
      readonly title: string
      readonly url?: string
      readonly children: ReadonlyArray<NavNode>
    }

export const pageUrl = (slug: ReadonlyArray<string>, base = '/docs'): string => [base, ...slug].join('/')

const byDefaultOrder = (a: PageEntry, b: PageEntry): number => {
  const index = (p: PageEntry) => (p.slug[p.slug.length - 1] === 'index' ? 0 : 1)
  return index(a) - index(b) || a.slug.join('/').localeCompare(b.slug.join('/'))
}

const folderNodes = (pages: ReadonlyArray<PageEntry>, depth: number, base: string): ReadonlyArray<NavNode> => {
  const children: Array<NavNode> = []
  const seen = new Set<string>()
  for (const page of [...pages].sort(byDefaultOrder)) {
    const name = page.slug[depth]!
    if (page.slug.length === depth + 1) {
      if (name !== 'index') children.push({ type: 'page', title: page.title, url: pageUrl(page.slug, base) })
    } else if (!seen.has(name)) {
      seen.add(name)
      children.push(
        folder(
          name,
          pages.filter((p) => p.slug[depth] === name && p.slug.length > depth + 1),
          depth + 1,
          base,
        ),
      )
    }
  }
  return children
}

const folder = (name: string, pages: ReadonlyArray<PageEntry>, depth: number, base: string): NavNode => {
  const index = pages.find((p) => p.slug.length === depth + 1 && p.slug[depth] === 'index')
  return {
    type: 'folder',
    title: index?.title ?? name,
    url: index ? pageUrl(index.slug, base) : undefined,
    children: folderNodes(pages, depth, base),
  }
}

/**
 * The sidebar tree: top level in order-file order (a slug that is a page becomes a page, one that is a folder becomes a
 * folder of its pages, the folder's `index` page first, the rest by slug), pages the file does not list last.
 */
export const buildNav = (order: OrderFile, pages: ReadonlyArray<PageEntry>, base = '/docs'): ReadonlyArray<NavNode> => {
  const top = (p: PageEntry) => p.slug[0] ?? 'index'
  const names = [
    ...order.pages,
    ...pages.map(top).filter((n, i, all) => !order.pages.includes(n) && all.indexOf(n) === i),
  ]
  return names.flatMap((name): ReadonlyArray<NavNode> => {
    const own = pages.filter((p) => top(p) === name)
    const leaf = own.find((p) => p.slug.length <= 1)
    if (leaf) return [{ type: 'page', title: leaf.title, url: pageUrl(leaf.slug, base) }]
    return own.length > 0 ? [folder(name, own, 1, base)] : []
  })
}

/** Every page of the tree in reading order (a folder's own page before its children). */
export const flatPages = (
  nodes: ReadonlyArray<NavNode>,
): ReadonlyArray<{ readonly title: string; readonly url: string }> =>
  nodes.flatMap((n) =>
    n.type === 'page'
      ? [{ title: n.title, url: n.url }]
      : [...(n.url ? [{ title: n.title, url: n.url }] : []), ...flatPages(n.children)],
  )

export const neighbours = (nodes: ReadonlyArray<NavNode>, url: string) => {
  const pages = flatPages(nodes)
  const i = pages.findIndex((p) => p.url === url)
  return { prev: i > 0 ? pages[i - 1] : undefined, next: i >= 0 ? pages[i + 1] : undefined }
}

export const containsUrl = (node: NavNode, url: string): boolean =>
  node.type === 'page' ? node.url === url : node.url === url || node.children.some((c) => containsUrl(c, url))
