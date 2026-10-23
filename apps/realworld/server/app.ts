import { start } from '@sleekstack/start'
import { Layer } from 'effect'
import services from 'virtual:sleek/server-registry'
import { pages } from '../src/app'
import { AppLive } from '../src/layers'
import { ArticlesApiLive } from './articles-api.server'
import { IdentityApiLive } from './identity-api.server'

export { SESSION } from './session'

/**
 * The server entry: the REST facade at `/api/` (the Controllers under `server/routes/api`), the Server Services and the
 * pages. The infra (`*.layer.ts`, SQLite at `CONDUIT_DB`) and the RPC Files are discovered by `serverServices()`.
 */
export const app = start({
  router: pages,
  layer: Layer.mergeAll(AppLive, IdentityApiLive, ArticlesApiLive),
  services,
})
