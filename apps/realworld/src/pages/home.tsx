/** @jsxImportSource @sleekstack/ui */
import { Atom } from '@sleekstack/core'
import { type Loader, loader, params, Route, useLoader } from '@sleekstack/router'
import { useAtomValue, useSetAtom } from '@sleekstack/ui'
import type { Stub } from '@sleekstack/start/client'
import { Effect, Schema } from 'effect'
import {
  ArticleList,
  ArticlePreviews,
  favoriteContract,
  feedContract,
  listArticlesContract,
  Pagination,
  tagsContract,
  type Toggle,
  unfavoriteContract,
  useArticleList,
  useStaleArticleLists,
} from '../modules/articles'
import { ServerFunctions } from './functions'
import { Layout, viewer } from './layout'
import { table } from './routes'

const PAGE_SIZE = 10

interface Paging {
  readonly limit: number
  readonly offset: number
}

/**
 * The page a list shows, for the path it was picked on: another path reads page 0, so the page resets when the route
 * changes. Client state only (loaders see the pathname, not a query string): the server always renders page 0.
 */
const pageAtom = Atom.make({ path: '', page: 0 })

/** How a list call fails: the list and feed functions share their errors. */
type ListFailure = Effect.Effect.Error<ReturnType<Stub<typeof listArticlesContract>>>
type Query = (paging: Paging) => Effect.Effect<ArticleList, ListFailure, ServerFunctions | Route>

/** A list of articles: its first page as a loader (server-rendered), any page by `query`. */
export interface ArticleSource {
  readonly first: Loader<ArticleList, typeof ArticleList.Encoded, ListFailure, ServerFunctions | Route>
  readonly query: Query
}

export const articleSource = (key: string, query: Query): ArticleSource => ({
  first: loader(key, ArticleList, query({ limit: PAGE_SIZE, offset: 0 })),
  query,
})

const LoadFailed = () => <div class="article-preview">Articles could not be loaded: try again.</div>

/**
 * A list's previews with its page links, through the query cache: the first page is seeded from the route's loader
 * (server-rendered, hydrated with no call); a picked page is fetched when first shown. A favorite marks every list
 * stale, so returning to a page shows the server's current state. A page being fetched shows "Loading", never its
 * stale previews: a preview's favorite button keeps the article it first rendered.
 */
export const ArticleFeed = function* ({ source }: { source: ArticleSource }) {
  const call = yield* ServerFunctions
  const services = yield* Effect.context<ServerFunctions | Route>()
  const { pathname } = yield* Route
  const user = yield* Effect.orElseSucceed(useLoader(viewer), () => null)
  const first = yield* Effect.either(useLoader(source.first))
  const picked = yield* useAtomValue(pageAtom)
  const pick = yield* useSetAtom(pageAtom)
  const stale = yield* useStaleArticleLists()
  const page = picked.path === pathname ? picked.page : 0
  const list = yield* useArticleList(
    { path: pathname, page, viewer: user?.username ?? null },
    Effect.provide(source.query({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }), services),
    page === 0 && first._tag === 'Right' ? first.right : undefined,
  )
  if (first._tag === 'Left') return <LoadFailed />
  const toggle: Toggle | null = user
    ? (a) => call(a.favorited ? unfavoriteContract : favoriteContract)({ slug: a.slug }).pipe(Effect.tap(stale))
    : null
  return (
    <>
      {list.isFetching || list.isPending ? (
        <div class="article-preview">Loading articles...</div>
      ) : list.isError ? (
        <LoadFailed />
      ) : (
        <ArticlePreviews articles={list.data.articles} toggle={toggle} />
      )}
      <Pagination
        count={first.right.articlesCount}
        size={PAGE_SIZE}
        page={page}
        onPick={(next) => pick({ path: pathname, page: next })}
      />
    </>
  )
}

export const globalArticles = articleSource('globalArticles', (paging) =>
  Effect.flatMap(ServerFunctions, (c) => c(listArticlesContract)(paging)),
)
export const feedArticles = articleSource('feedArticles', (paging) =>
  Effect.flatMap(ServerFunctions, (c) => c(feedContract)(paging)),
)
export const tagArticles = articleSource('tagArticles', (paging) =>
  Effect.flatMap(Effect.zip(ServerFunctions, params(table, 'tag')), ([c, { tag }]) =>
    c(listArticlesContract)({ ...paging, tag }),
  ),
)

/** Every tag in use, for the sidebar. */
export const popularTags = loader(
  'popularTags',
  Schema.Array(Schema.String),
  Effect.flatMap(ServerFunctions, (c) => c(tagsContract)()),
)

const tagHref = (tag: string) => `/tag/${encodeURIComponent(tag)}`

const Sidebar = function* () {
  const tags = yield* Effect.either(useLoader(popularTags))
  return (
    <div class="sidebar">
      <p>Popular Tags</p>
      {tags._tag === 'Left' ? (
        <div>Tags could not be loaded.</div>
      ) : (
        <div class="tag-list">
          {tags.right.map((t) => (
            <a key={t} href={tagHref(t)} class="tag-pill tag-default">
              {t}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

type Tab = { readonly kind: 'feed' } | { readonly kind: 'global' } | { readonly kind: 'tag'; readonly tag: string }

const TabLink = ({ href, active, children }: { href: string; active: boolean; children?: string }) => (
  <li class="nav-item">
    <a class={active ? 'nav-link active' : 'nav-link'} href={href}>
      {children}
    </a>
  </li>
)

/** The banner (signed-out only), the feed tabs, the list and the tag sidebar. Your Feed is offered to a signed-in viewer. */
const Home = function* ({ tab, source }: { tab: Tab; source: ArticleSource }) {
  const user = yield* Effect.orElseSucceed(useLoader(viewer), () => null)
  return (
    <div class="home-page">
      {!user && (
        <div class="banner">
          <div class="container">
            <h1 class="logo-font">conduit</h1>
            <p>A place to share your knowledge.</p>
          </div>
        </div>
      )}
      <div class="container page">
        <div class="row">
          <div class="col-md-9">
            <div class="feed-toggle">
              <ul class="nav nav-pills outline-active">
                {user && (
                  <TabLink href="/feed" active={tab.kind === 'feed'}>
                    Your Feed
                  </TabLink>
                )}
                <TabLink href="/" active={tab.kind === 'global'}>
                  Global Feed
                </TabLink>
                {tab.kind === 'tag' && (
                  <TabLink href={tagHref(tab.tag)} active>
                    {`#${tab.tag}`}
                  </TabLink>
                )}
              </ul>
            </div>
            <ArticleFeed source={source} />
          </div>
          <div class="col-md-3">
            <Sidebar />
          </div>
        </div>
      </div>
    </div>
  )
}

export const HomePage = () => (
  <Layout>
    <Home tab={{ kind: 'global' }} source={globalArticles} />
  </Layout>
)

export const FeedPage = () => (
  <Layout>
    <Home tab={{ kind: 'feed' }} source={feedArticles} />
  </Layout>
)

const TagHome = function* () {
  const { tag } = yield* params(table, 'tag')
  return <Home tab={{ kind: 'tag', tag }} source={tagArticles} />
}

export const TagPage = () => (
  <Layout>
    <TagHome />
  </Layout>
)
