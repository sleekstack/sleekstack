import { describe, expect, it } from 'vitest'
import { enumerate, type PrerenderRoutes } from '../enumerate.js'

const routes: PrerenderRoutes = {
  table: { index: '/', about: '/about/', user: '/users/:id', post: '/users/:id/posts/:post', tag: '/tags/:tag' },
  pages: {
    index: {},
    about: {},
    user: { prerender: async () => [{ id: '1' }, { id: 'a b' }] },
    post: { prerender: async () => [{ id: '1', post: 'x' }] },
    tag: {},
  },
}

describe('enumerate', () => {
  it('prerenders nothing when the option is off', async () => {
    expect(await enumerate(routes, undefined)).toEqual({ paths: [], warnings: [] })
  })

  it('includes static routes for true, without a trailing slash', async () => {
    const { paths } = await enumerate(routes, true)
    expect(paths.slice(0, 2)).toEqual(['/', '/about'])
  })

  it('expands dynamic routes from prerender(), percent-encoding values', async () => {
    const { paths } = await enumerate(routes, [])
    expect(paths).toEqual(['/users/1', '/users/a%20b', '/users/1/posts/x'])
  })

  it('unions listed paths with expansions, deduplicated and normalized', async () => {
    const { paths } = await enumerate(routes, ['/users/1/', 'about', '/about'])
    expect(paths).toEqual(['/users/1', '/users/a%20b', '/users/1/posts/x', '/about'])
  })

  it('skips a dynamic route without prerender() with a warning naming it', async () => {
    expect((await enumerate(routes, true)).warnings).toEqual([
      "prerender: skipped dynamic route 'tag' (/tags/:tag): it has no prerender()",
    ])
    expect((await enumerate(routes, ['/tags/a'])).warnings).toEqual([])
  })

  it('fails naming the route when prerender() omits a param', async () => {
    const bad = { table: { user: '/users/:id' }, pages: { user: { prerender: async () => [{}] } } }
    await expect(enumerate(bad, true)).rejects.toThrow("route 'user' (/users/:id): prerender() gave no 'id'")
  })
})
