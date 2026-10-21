import { router } from '@sleekstack/router'
import { pages, table } from 'virtual:sleekstack/routes'

// In the client build each page is its own chunk, loaded on first navigation (the first one before hydrating).
export const app = router({ table, pages, notFound: () => <h1>Not found</h1> })
