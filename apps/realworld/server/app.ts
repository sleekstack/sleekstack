import { QueryClientLive } from '@sleekstack/query'
import { start } from '@sleekstack/start'
import { Layer } from 'effect'
import services from 'virtual:sleek/server-registry'
import { pages } from '../src/app'
import { AppLive } from '../src/layers'
import { ArticlesApiLive } from './articles-api.server'
import { CommentsApiLive } from './comments-api.server'
import { DbLive } from './db'
import { TokenSecretLive } from './identity'
import { IdentityApiLive } from './identity-api.server'

export { SESSION } from './identity-api.server'

/**
 * The server's `QueryClient`: a page's lists take their first page from its loader (`initialData`) and never fetch here.
 * It carries no `Transfer`, so its cache never rides a response, and an entry is dropped right after it is read.
 */
// ponytail: one client for the process (start has no per-request layer). A list's key holds its path, page and viewer,
// so a concurrent render of the same key gets that viewer's data from moments earlier. Per-request client once start has one.
const ServerQueriesLive = QueryClientLive({ defaultOptions: { queries: { gcTime: 0 } } })

/**
 * The server entry: the REST facade at `/api/` (the Controllers under `server/routes/api`, discovered by
 * `serverServices()`), the Server Services and the pages, over SQLite (`CONDUIT_DB`, default `./data/conduit.db`).
 */
export const app = start({
  router: pages,
  layer: Layer.mergeAll(IdentityApiLive, ArticlesApiLive, CommentsApiLive).pipe(
    Layer.provideMerge(Layer.mergeAll(AppLive, ServerQueriesLive, DbLive(process.env.CONDUIT_DB), TokenSecretLive)),
  ),
  services,
})
