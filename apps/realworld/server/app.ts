import { start } from '@sleekstack/start'
import services from 'virtual:sleek/server-registry'
import { pages } from '../src/app'

export { SESSION } from './session'

/**
 * The server entry: the REST facade at `/api/` (the Controllers under `server/routes/api`), the Server Services and the
 * pages. The infra (`*.layer.ts`, SQLite at `CONDUIT_DB`) and the RPC Files are discovered by `serverServices()`, so no
 * Layer is listed here.
 */
export const app = start({ router: pages, services })
