import { Layer } from 'effect'
import { handle, router, startRouter } from '@sleekstack/router'
import { notFound, pages, table } from 'virtual:sleekstack/routes'
import { DbLive, RepoLive } from './tags'

const app = router({ table, pages, notFound })

// Db is not provided: the about page's render and the data page's loaders report it in their route files.
export const client = (c: Element) => startRouter(app, { container: c, layer: RepoLive })
// Everything provided: nothing reported.
export const server = (req: Request) => handle(app, req, { layer: Layer.merge(RepoLive, DbLive) })
