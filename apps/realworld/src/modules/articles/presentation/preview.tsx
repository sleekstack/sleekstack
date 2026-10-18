/** @jsxImportSource @sleekstack/ui */
import { Result } from '@sleekstack/core'
import { useAction, useAtomValue, useDerivedAtom, useFormStatus, useOptimistic } from '@sleekstack/ui'
import { type Effect, Option } from 'effect'
import type { Article } from '../domain/model'

/** Favorites or unfavorites `article` on the server, and returns it as the viewer now sees it. */
export type Toggle = (article: Article) => Effect.Effect<Article, unknown>

const profileHref = (username: string) => `/profile/${encodeURIComponent(username)}`

/** A date as "January 20, 2026", the same on the server and in any browser time zone. */
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

const favorited = (a: Article, on: boolean): Article => ({
  ...a,
  favorited: on,
  favoritesCount: a.favoritesCount + (on ? 1 : -1),
})

/**
 * The heart button: the new count shows at once and rolls back when the server refuses. A signed-out viewer gets a link
 * to `/login` instead.
 */
const FavoriteButton = function* ({ article, toggle }: { article: Article; toggle: Toggle | null }) {
  const [result, run] = yield* useAction((): Effect.Effect<Article, unknown> =>
    optimistic(!current.favorited, toggle!(current)),
  )
  // The article as the server last returned it: the latest toggle's result, else the one the list loaded.
  const confirmed = yield* useDerivedAtom((get) => Option.getOrElse(Result.value(get(result)), () => article))
  const [shown, optimistic] = yield* useOptimistic(confirmed, favorited)
  const current = yield* useAtomValue(confirmed)
  const view = yield* useAtomValue(shown)
  const { pending } = yield* useFormStatus(result)
  const style = `btn btn-sm pull-xs-right ${view.favorited ? 'btn-primary' : 'btn-outline-primary'}`
  const label = (
    <>
      <i class="ion-heart"></i> {view.favoritesCount}
    </>
  )
  if (!toggle)
    return (
      <a class={style} href="/login">
        {label}
      </a>
    )
  return (
    <form class="favorite" action={run}>
      <button class={style} type="submit" disabled={pending}>
        {label}
      </button>
    </form>
  )
}

const ArticlePreview = ({ article, toggle }: { article: Article; toggle: Toggle | null }) => (
  <div class="article-preview">
    <div class="article-meta">
      <a href={profileHref(article.author.username)}>
        {article.author.image && <img src={article.author.image} alt="" />}
      </a>
      <div class="info">
        <a href={profileHref(article.author.username)} class="author">
          {article.author.username}
        </a>
        <span class="date">{formatDate(article.createdAt)}</span>
      </div>
      <FavoriteButton article={article} toggle={toggle} />
    </div>
    <a href={`/article/${encodeURIComponent(article.slug)}`} class="preview-link">
      <h1>{article.title}</h1>
      <p>{article.description}</p>
      <span>Read more...</span>
      <ul class="tag-list">
        {article.tagList.map((t) => (
          <li key={t} class="tag-default tag-pill tag-outline">
            {t}
          </li>
        ))}
      </ul>
    </a>
  </div>
)

/** One page of previews, or the empty state. `toggle` is `null` for a signed-out viewer. */
export const ArticlePreviews = ({ articles, toggle }: { articles: ReadonlyArray<Article>; toggle: Toggle | null }) =>
  articles.length === 0 ? (
    <div class="article-preview">No articles are here... yet.</div>
  ) : (
    <>
      {articles.map((a) => (
        <ArticlePreview key={a.slug} article={a} toggle={toggle} />
      ))}
    </>
  )

/** Numbered page links for `count` articles, `size` to a page; `page` is zero-based. Nothing for a single page. */
export const Pagination = ({
  count,
  size,
  page,
  onPick,
}: {
  count: number
  size: number
  page: number
  onPick: (page: number) => void
}) => {
  const pages = Math.ceil(count / size)
  if (pages <= 1) return <></>
  return (
    <nav>
      <ul class="pagination">
        {Array.from({ length: pages }, (_, i) => i).map((i) => (
          <li key={i} class={i === page ? 'page-item active' : 'page-item'}>
            <button type="button" class="page-link" onClick={() => onPick(i)}>
              {i + 1}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
