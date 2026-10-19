import { effectFn, QueryClientTag } from '@sleekstack/query'
import { useQuery } from '@sleekstack/query/ui'
import { Effect } from 'effect'
import type { ArticleList } from '../domain/model'

// The cache key lives here only: the reads and the invalidation after a favorite cannot drift apart.
const KEY = 'articles'

/** Which page of which list, for whom: the route's path (tab, tag or author), the zero-based page, the viewer's name. */
export interface ListIdentity {
  readonly path: string
  readonly page: number
  readonly viewer: string | null
}

/**
 * One page of an article list, cached by `identity`. `initial` seeds the cache (the server-rendered first page), so a
 * hydrated list makes no call; any other page is fetched by `fetch` when first shown.
 */
export const useArticleList = <E>(
  identity: ListIdentity,
  fetch: Effect.Effect<ArticleList, E>,
  initial: ArticleList | undefined,
) =>
  useQuery<ArticleList, E>({
    queryKey: [KEY, identity.path, identity.page, identity.viewer],
    queryFn: effectFn(fetch),
    initialData: initial,
  })

/**
 * Marks every cached article list stale after a favorite changed one of them: the page shown keeps its data, and the
 * next page shown, the one left included, is fetched again.
 */
export const useStaleArticleLists = () =>
  Effect.map(QueryClientTag, (client) => () => void client.invalidateQueries({ queryKey: [KEY], refetchType: 'none' }))
