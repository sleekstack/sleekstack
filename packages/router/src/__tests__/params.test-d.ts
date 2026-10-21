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

// @ts-expect-error a colon inside a segment is not a param
export const embedded: Params<'/item:format'>['format'] = ''

export const splat: { readonly path: string } = {} as Params<'/files/*path'>
export const optional: { readonly id?: string } = {} as Params<'/u/:id?'>
export const both: { readonly org: string; readonly rest: string } = {} as Params<'/o/:org/*rest'>

// @ts-expect-error an optional param may be missing
export const required: { readonly id: string } = {} as Params<'/u/:id?'>

// @ts-expect-error a splat is not a ':' param named '*path'
export const star: Params<'/files/*path'>['*path'] = ''

export const loose: Record<string, string> = {} as Params<string>
