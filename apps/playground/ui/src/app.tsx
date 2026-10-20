import { router } from '@sleekstack/router'
import { pages, table } from 'virtual:sleekstack/routes'
import Home from './routes/index'
import User from './routes/users/[id]'

// Renders written out, not the routes module's `pages`: `sleekstack check` reads only an object literal here.
export const app = router({
  table,
  pages: {
    index: { render: () => <Home /> },
    'users/[id]': { prerender: pages['users/[id]'].prerender, render: () => <User /> },
  },
  notFound: () => <h1>Not found</h1>,
})
