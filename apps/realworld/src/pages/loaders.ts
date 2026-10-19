import { type Loader, loader, notFound, redirect, Route, useLoader } from '@sleekstack/router'
import type { Stub } from '@sleekstack/start/client'
import { Effect, Schema } from 'effect'
import { Article, ArticleList, getArticleContract, listArticlesContract } from '../modules/articles'
import { Comment, listCommentsContract } from '../modules/comments'
import { Profile, profileContract } from '../modules/identity'
import { ServerFunctions } from './functions'
import { type RouteLoaders, signedIn, viewer } from './layout'
import { table } from './routes'

// The loaders that a link on another page names, apart from the pages so any page imports them without a cycle.

export const PAGE_SIZE = 10

interface Paging {
  readonly limit: number
  readonly offset: number
}

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

// The article and editor routes both name the article `:slug`.
const slug = Effect.map(Route, (m) => m.params['slug']!)

/** The article the route names; an unknown slug is the 404 page. */
export const article = loader(
  'article',
  Article,
  Effect.flatMap(Effect.zip(ServerFunctions, slug), ([call, s]) => call(getArticleContract)({ slug: s })).pipe(
    Effect.catchTag('NotFound', notFound),
  ),
)

/** The article's comments, newest first. */
export const comments = loader(
  'comments',
  Schema.Array(Comment),
  Effect.flatMap(Effect.zip(ServerFunctions, slug), ([call, s]) => call(listCommentsContract)({ slug: s })).pipe(
    Effect.catchTag('NotFound', notFound),
  ),
)

// Both profile routes name the user `:username`.
const username = Effect.map(Route, (m) => m.params['username']!)

/** The profile the route names; an unknown user is the 404 page. */
export const profile = loader(
  'profile',
  Profile,
  Effect.flatMap(Effect.zip(ServerFunctions, username), ([call, name]) =>
    call(profileContract)({ username: name }),
  ).pipe(Effect.catchTag('NotFound', notFound)),
)

export const authoredArticles = articleSource('authoredArticles', (paging) =>
  Effect.flatMap(Effect.zip(ServerFunctions, username), ([call, author]) =>
    call(listArticlesContract)({ ...paging, author }),
  ),
)
export const favoritedArticles = articleSource('favoritedArticles', (paging) =>
  Effect.flatMap(Effect.zip(ServerFunctions, username), ([call, favorited]) =>
    call(listArticlesContract)({ ...paging, favorited }),
  ),
)

const articleHref = (slug: string) => `/article/${encodeURIComponent(slug)}`

/** The article to edit: only its author may; anyone else is sent to the article. */
export const editable = loader(
  'editable',
  Article,
  Effect.flatMap(Effect.zip(useLoader(signedIn), useLoader(article)), ([user, a]) =>
    a.author.username === user.username ? Effect.succeed(a) : redirect(articleHref(a.slug)),
  ),
)

// Each linked route's loaders as `app.tsx` declares them, for hover and focus prefetch.
export const articleLoaders: RouteLoaders = [viewer, article, comments]
export const profileLoaders: RouteLoaders = [viewer, profile, authoredArticles.first]
export const favoritesLoaders: RouteLoaders = [viewer, profile, favoritedArticles.first]
export const editLoaders: RouteLoaders = [viewer, signedIn, article, editable]
/** `/login` and `/register` both declare only `viewer`. */
export const authLoaders: RouteLoaders = [viewer]

/** The link targets an article preview (and its signed-out favorite button) renders. */
export const previewLinks = { table, article: articleLoaders, profile: profileLoaders, login: authLoaders }
