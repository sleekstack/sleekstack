import { router } from '@sleekstack/router'
import { notFound, pages as routePages, table } from 'virtual:sleekstack/routes'

export { ServerFunctionsClient } from './pages/functions'

/**
 * The pages, one route file each under `routes/` (the root layout adds the header and `viewer`, `(guarded)` adds
 * `signedIn`): rendered by `start` on the server and run by `startRouter` in the browser.
 */
export const pages = router({ table, pages: routePages, notFound })
