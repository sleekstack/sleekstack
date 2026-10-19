import { router } from '@sleekstack/router'
import { table } from 'virtual:sleekstack/routes'
import Home from './routes/index'
import User from './routes/users/[id]'

// Pages written out, not taken from the routes module's `pages`: `sleekstack check` reads only an object literal here.
export const app = router({
  table,
  pages: { index: { render: () => <Home /> }, 'users/[id]': { render: () => <User /> } },
  notFound: () => <h1>Not found</h1>,
})
