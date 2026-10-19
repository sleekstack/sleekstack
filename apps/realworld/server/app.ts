import { QueryClientLive } from '@sleekstack/query'
import type { NotFound, Redirect } from '@sleekstack/router'
import { Cookies, Request, serverFn, start } from '@sleekstack/start'
import { type Context, Effect, Layer, Option, type Schema } from 'effect'
import { pages } from '../src/app'
import { AppLive } from '../src/layers'
import * as articles from '../src/modules/articles'
import * as comments from '../src/modules/comments'
import * as identity from '../src/modules/identity'
import { type User, Viewer } from '../src/modules/identity'
import { ServerFunctions } from '../src/pages/functions'
import {
  createArticle,
  deleteArticle,
  favorite,
  feed,
  getArticle,
  listArticles,
  tags,
  unfavorite,
  updateArticle,
} from './articles'
import { addComment, deleteComment, listComments } from './comments'
import { DbLive } from './db'
import {
  currentUser,
  follow,
  login,
  profile,
  register,
  TokenSecretLive,
  unfollow,
  updateUser,
  ViewerLive,
} from './identity'
import { rest } from './rest'

/** The session cookie: the token, out of reach of scripts. */
export const SESSION = 'conduit_session'
// The token's own lifetime (server/crypto.ts).
const SESSION_SECONDS = 30 * 24 * 60 * 60

/**
 * `effect` as the viewer whose token the session cookie holds: anonymous without one. A stale cookie (bad, expired, or
 * naming a deleted user) is cleared and reads as anonymous too, so a function that needs a viewer is `Unauthorized`.
 */
const asViewer = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.flatMap(Cookies, (cookies) =>
    Effect.provide(
      effect,
      ViewerLive(cookies.get(SESSION)).pipe(
        Layer.catchAll(() =>
          Layer.effect(Viewer, Effect.as(Effect.orDie(cookies.delete(SESSION, { path: '/' })), Option.none())),
        ),
      ),
    ),
  )

/** Session cookies are `Secure` in production and on any https request; dev over http keeps working. */
const secure = Effect.map(
  Request,
  (request) => process.env.NODE_ENV === 'production' || request.url.startsWith('https:'),
)

/** Signs `user` in on this browser: the session cookie holds their token. */
const signIn = (user: User) =>
  Effect.flatMap(Effect.zip(Cookies, secure), ([cookies, secure]) =>
    cookies.set(SESSION, user.token, { httpOnly: true, secure, sameSite: 'Lax', path: '/', maxAge: SESSION_SECONDS }),
  ).pipe(Effect.orDie, Effect.as(user))

type AnySchema = Schema.Schema<any, any, never>

/** The server function for `contract`, its body run as the session cookie's viewer; failures as `serverFn` allows. */
const viewerFn = <const Id extends string, In extends AnySchema, Out extends AnySchema, Err extends AnySchema, R>(
  contract: { readonly id: Id; readonly input: In; readonly success: Out; readonly error: Err },
  run: (
    input: Schema.Schema.Type<In>,
  ) => Effect.Effect<Schema.Schema.Type<Out>, Schema.Schema.Type<Err> | NotFound | Redirect, R>,
) =>
  serverFn(
    contract.id,
    contract,
  )(function* (input) {
    return yield* asViewer(run(input))
  })

const functions = [
  serverFn(
    identity.registerContract.id,
    identity.registerContract,
  )(function* (input) {
    return yield* Effect.flatMap(register(input), signIn)
  }),
  serverFn(
    identity.loginContract.id,
    identity.loginContract,
  )(function* (input) {
    return yield* Effect.flatMap(login(input), signIn)
  }),
  serverFn(
    identity.logoutContract.id,
    identity.logoutContract,
  )(function* () {
    const cookies = yield* Cookies
    yield* Effect.orDie(cookies.delete(SESSION, { path: '/' }))
  }),
  viewerFn(identity.currentUserContract, () => currentUser),
  viewerFn(identity.updateUserContract, updateUser),
  viewerFn(identity.profileContract, ({ username }) => profile(username)),
  viewerFn(identity.followContract, ({ username }) => follow(username)),
  viewerFn(identity.unfollowContract, ({ username }) => unfollow(username)),
  viewerFn(articles.listArticlesContract, listArticles),
  viewerFn(articles.feedContract, feed),
  viewerFn(articles.getArticleContract, ({ slug }) => getArticle(slug)),
  viewerFn(articles.createArticleContract, createArticle),
  viewerFn(articles.updateArticleContract, ({ slug, article }) => updateArticle(slug, article)),
  viewerFn(articles.deleteArticleContract, ({ slug }) => deleteArticle(slug)),
  viewerFn(articles.favoriteContract, ({ slug }) => favorite(slug)),
  viewerFn(articles.unfavoriteContract, ({ slug }) => unfavorite(slug)),
  viewerFn(articles.tagsContract, () => tags),
  viewerFn(comments.listCommentsContract, ({ slug }) => listComments(slug)),
  viewerFn(comments.addCommentContract, ({ slug, comment }) => addComment(slug, comment)),
  viewerFn(comments.deleteCommentContract, ({ slug, id }) => deleteComment(slug, id)),
]

const byId = new Map(functions.map((fn) => [fn.id, fn]))
/**
 * The server's `ServerFunctions`: a page's loaders call the function in place. Its services (`Db`, `Cookies`, ...) are
 * not in the stub's type: the page renders on the request fiber's runtime, which provides them.
 */
const ServerFunctionsInPlace = Layer.succeed(ServerFunctions, ((contract: { readonly id: string }) =>
  byId.get(contract.id)!) as unknown as Context.Tag.Service<ServerFunctions>)

/**
 * The server's `QueryClient`: a page's lists take their first page from its loader (`initialData`) and never fetch here.
 * It carries no `Transfer`, so its cache never rides a response, and an entry is dropped right after it is read.
 */
// ponytail: one client for the process (start has no per-request layer). A list's key holds its path, page and viewer,
// so a concurrent render of the same key gets that viewer's data from moments earlier. Per-request client once start has one.
const ServerQueriesLive = QueryClientLive({ defaultOptions: { queries: { gcTime: 0 } } })

/**
 * The server entry: the REST facade at `/api/`, the server functions and the pages, over SQLite (`CONDUIT_DB`, default
 * `./data/conduit.db`).
 */
export const app = start({
  router: pages,
  layer: Layer.mergeAll(
    AppLive,
    ServerQueriesLive,
    DbLive(process.env.CONDUIT_DB),
    TokenSecretLive,
    ServerFunctionsInPlace,
  ),
  middleware: [rest],
  functions,
})
