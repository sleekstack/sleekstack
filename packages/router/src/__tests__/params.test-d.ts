import { Effect } from 'effect'
import { params, routes, type Params } from '../index'

const table = routes({ home: '/', post: '/users/:id/posts/:post' })

export const typed = Effect.map(params(table, 'post'), (p) => {
  const ok: { readonly id: string; readonly post: string } = p
  // @ts-expect-error not a param of '/users/:id/posts/:post'
  p.slug
  return ok
})

// @ts-expect-error not a route name
params(table, 'nope')

// @ts-expect-error '/' has no params
export const none: Params<'/'>['id'] = ''
