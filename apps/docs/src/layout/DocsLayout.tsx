/** @jsxImportSource @sleekstack/ui */
import { useLocal, type Child } from '@sleekstack/ui'
import { PageFooter } from './PageFooter'
import { SearchDialog } from '../search/SearchDialog'
import { Sidebar } from './Sidebar'
import { ThemeSwitcher } from './ThemeSwitcher'
import type { NavNode } from './nav'

/** Header, sidebar (a drawer on small screens), the page and its previous and next footer. */
export const DocsLayout = function* ({
  title,
  tree,
  current,
  home = '/docs',
  indexUrl = '/search-index.json',
  children,
}: {
  title: string
  tree: ReadonlyArray<NavNode>
  current: string
  /** The site title's link: the root page's URL. */
  home?: string
  /** Where the search index is served. */
  indexUrl?: string
  children?: Child
}) {
  const [open, setOpen] = yield* useLocal(false)
  return (
    <div class="docs">
      <header class="topbar">
        <button
          type="button"
          class="menu"
          aria-label="Menu"
          aria-expanded={open ? 'true' : 'false'}
          onClick={() => setOpen((o) => !o)}
        >
          Menu
        </button>
        <a class="site-title" href={home}>
          {title}
        </a>
        <SearchDialog indexUrl={indexUrl} />
        <ThemeSwitcher />
      </header>
      {open && <button type="button" class="backdrop" aria-label="Close menu" onClick={() => setOpen(false)} />}
      <Sidebar tree={tree} current={current} open={open} onNavigate={() => setOpen(false)} />
      <main class="content">
        <article class="prose">{children}</article>
        <PageFooter tree={tree} current={current} />
      </main>
    </div>
  )
}
