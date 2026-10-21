import {
  type LinkProps,
  type Loader,
  type Loaders,
  loader,
  notFound,
  redirect,
  Route,
  useLoader,
} from '@sleekstack/router'
import type { Stub } from '@sleekstack/start/client'
import { Effect, Schema } from 'effect'
import { Article, ArticleList, getArticleContract, listArticlesContract } from '../modules/articles'
import { Comment, listCommentsContract } from '../modules/comments'
import { Account, currentUserContract, Profile, profileContract } from '../modules/identity'
import { ServerFunctions } from './functions'

// The loaders that a link on another page names, apart from the pages so any page imports them without a cycle.

/**
 * Who is signed in, or `null`: the root layout declares it, so the server resolves it from the session cookie and sends
 * it with the page, and the hydrating browser renders the same header. A bad session reads as signed out.
 */
export const viewer = loader(
  'viewer',
  Schema.NullOr(Account),
  Effect.flatMap(ServerFunctions, (call) => call(currentUserContract)()).pipe(
    Effect.catchTag('Unauthorized', () => Effect.succeed(null)),
  ),
)

/** The signed-in user, for a page only they may see: anyone else is sent to `/login`. */
export const signedIn = loader(
  'signedIn',
  Account,
  Effect.flatMap(useLoader(viewer), (user) => (user ? Effect.succeed(user) : redirect('/login'))),
)

/** A target route's loaders (its layouts' and its own) for a page-body `Link`, so hover and focus prefetch them. */
export type RouteLoaders = LinkProps<ServerFunctions | Route | Loaders>['loaders']

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

// Each linked route's loaders as its route file and layouts declare them, for hover and focus prefetch.
export const articleLoaders: RouteLoaders = [viewer, article, comments]
export const profileLoaders: RouteLoaders = [viewer, profile, authoredArticles.first]
export const favoritesLoaders: RouteLoaders = [viewer, profile, favoritedArticles.first]
export const editLoaders: RouteLoaders = [viewer, signedIn, article, editable]
/** `/login` and `/register` both declare only `viewer`. */
export const authLoaders: RouteLoaders = [viewer]
