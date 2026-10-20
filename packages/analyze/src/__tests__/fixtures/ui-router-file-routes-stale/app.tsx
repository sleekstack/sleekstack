import { router, startRouter } from '@sleekstack/router'
import { pages, table } from 'virtual:sleekstack/routes'

const app = router({ table, pages, notFound: () => <h1>Not found</h1> })

export const client = (c: Element) => startRouter(app, { container: c })
