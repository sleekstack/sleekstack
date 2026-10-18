import { Cookies, serverFn, start } from '@sleekstack/start'
import { type Context, Effect, Layer } from 'effect'
import { pages } from '../src/app'
import { AppLive } from '../src/layers'
import * as articles from '../src/modules/articles'
import * as comments from '../src/modules/comments'
import * as identity from '../src/modules/identity'
import type { User } from '../src/modules/identity'
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

/** `effect` as the viewer whose token the session cookie holds: anonymous without one, `Unauthorized` for a bad one. */
const asViewer = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.flatMap(Cookies, (cookies) => Effect.provide(effect, ViewerLive(cookies.get(SESSION))))

/** Signs `user` in on this browser: the session cookie holds their token. */
const signIn = (user: User) =>
  Effect.flatMap(Cookies, (cookies) =>
    cookies.set(SESSION, user.token, { httpOnly: true, sameSite: 'Lax', path: '/', maxAge: SESSION_SECONDS }),
  ).pipe(Effect.orDie, Effect.as(user))

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
  serverFn(
    identity.currentUserContract.id,
    identity.currentUserContract,
  )(function* () {
    return yield* asViewer(currentUser)
  }),
  serverFn(
    identity.updateUserContract.id,
    identity.updateUserContract,
  )(function* (input) {
    return yield* asViewer(updateUser(input))
  }),
  serverFn(
    identity.profileContract.id,
    identity.profileContract,
  )(function* ({ username }) {
    return yield* asViewer(profile(username))
  }),
  serverFn(
    identity.followContract.id,
    identity.followContract,
  )(function* ({ username }) {
    return yield* asViewer(follow(username))
  }),
  serverFn(
    identity.unfollowContract.id,
    identity.unfollowContract,
  )(function* ({ username }) {
    return yield* asViewer(unfollow(username))
  }),
  serverFn(
    articles.listArticlesContract.id,
    articles.listArticlesContract,
  )(function* (query) {
    return yield* asViewer(listArticles(query))
  }),
  serverFn(
    articles.feedContract.id,
    articles.feedContract,
  )(function* (page) {
    return yield* asViewer(feed(page))
  }),
  serverFn(
    articles.getArticleContract.id,
    articles.getArticleContract,
  )(function* ({ slug }) {
    return yield* asViewer(getArticle(slug))
  }),
  serverFn(
    articles.createArticleContract.id,
    articles.createArticleContract,
  )(function* (input) {
    return yield* asViewer(createArticle(input))
  }),
  serverFn(
    articles.updateArticleContract.id,
    articles.updateArticleContract,
  )(function* ({ slug, article }) {
    return yield* asViewer(updateArticle(slug, article))
  }),
  serverFn(
    articles.deleteArticleContract.id,
    articles.deleteArticleContract,
  )(function* ({ slug }) {
    return yield* asViewer(deleteArticle(slug))
  }),
  serverFn(
    articles.favoriteContract.id,
    articles.favoriteContract,
  )(function* ({ slug }) {
    return yield* asViewer(favorite(slug))
  }),
  serverFn(
    articles.unfavoriteContract.id,
    articles.unfavoriteContract,
  )(function* ({ slug }) {
    return yield* asViewer(unfavorite(slug))
  }),
  serverFn(
    articles.tagsContract.id,
    articles.tagsContract,
  )(function* () {
    return yield* asViewer(tags)
  }),
  serverFn(
    comments.listCommentsContract.id,
    comments.listCommentsContract,
  )(function* ({ slug }) {
    return yield* asViewer(listComments(slug))
  }),
  serverFn(
    comments.addCommentContract.id,
    comments.addCommentContract,
  )(function* ({ slug, comment }) {
    return yield* asViewer(addComment(slug, comment))
  }),
  serverFn(
    comments.deleteCommentContract.id,
    comments.deleteCommentContract,
  )(function* ({ slug, id }) {
    return yield* asViewer(deleteComment(slug, id))
  }),
]

const byId = new Map(functions.map((fn) => [fn.id, fn]))
/**
 * The server's `ServerFunctions`: a page's loaders call the function in place. Its services (`Db`, `Cookies`, ...) are
 * not in the stub's type: the page renders on the request fiber's runtime, which provides them.
 */
const ServerFunctionsInPlace = Layer.succeed(ServerFunctions, ((contract: { readonly id: string }) =>
  byId.get(contract.id)!) as unknown as Context.Tag.Service<ServerFunctions>)

/**
 * The server entry: the REST facade at `/api/`, the server functions and the pages, over SQLite (`CONDUIT_DB`, default
 * `./data/conduit.db`).
 */
export const app = start({
  router: pages,
  layer: Layer.mergeAll(AppLive, DbLive(process.env.CONDUIT_DB), TokenSecretLive, ServerFunctionsInPlace),
  middleware: [rest],
  functions,
})
