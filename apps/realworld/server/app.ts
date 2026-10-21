import { QueryClientLive } from '@sleekstack/query'
import type { NotFound, Redirect } from '@sleekstack/router'
import { serverFn, start } from '@sleekstack/start'
import { type Context, type Effect, Layer, type Schema } from 'effect'
import services from 'virtual:sleek/server-registry'
import { pages } from '../src/app'
import { AppLive } from '../src/layers'
import * as articles from '../src/modules/articles'
import * as comments from '../src/modules/comments'
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
import { TokenSecretLive } from './identity'
import { asViewer, IdentityApiLive } from './identity-api.server'
import { rest } from './rest'

export { SESSION } from './identity-api.server'

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
 * The server entry: the REST facade at `/api/`, the server functions, the Server Services and the pages, over SQLite
 * (`CONDUIT_DB`, default `./data/conduit.db`).
 */
export const app = start({
  router: pages,
  layer: IdentityApiLive.pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        AppLive,
        ServerQueriesLive,
        DbLive(process.env.CONDUIT_DB),
        TokenSecretLive,
        ServerFunctionsInPlace,
      ),
    ),
  ),
  middleware: [rest],
  functions,
  services,
})
