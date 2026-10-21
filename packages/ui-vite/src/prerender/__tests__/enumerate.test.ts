import { router } from '@sleekstack/router'
import { Effect } from 'effect'
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

  it.each([
    [{}, "gave no 'toString'"],
    [{ toString: '' }, "gave no 'toString'"],
    [{ toString: '..' }, "gave '..' for 'toString'"],
    [{ toString: '.' }, "gave '.' for 'toString'"],
  ])('fails naming the route when prerender() gives %o', async (params, why) => {
    const bad = { table: { item: '/items/:toString' }, pages: { item: { prerender: async () => [params] } } }
    await expect(enumerate(bad, true)).rejects.toThrow(`route 'item' (/items/:toString): prerender() ${why}`)
  })

  it('accepts a router whose pages render and some declare prerender()', async () => {
    const app = router({
      table: { home: '/', user: '/users/:id' },
      pages: {
        home: { render: () => Effect.succeed(null) },
        user: { render: () => Effect.succeed(null), prerender: async () => [{ id: '7' }] },
      },
      notFound: () => Effect.succeed(null),
    })
    expect((await enumerate(app, true)).paths).toEqual(['/', '/users/7'])
  })

  it('expands optional and splat routes: an omitted optional drops its segment, a splat takes a /-joined value', async () => {
    const dynamic: PrerenderRoutes = {
      table: { posts: '/posts/:page?', guide: '/guide/*slug' },
      pages: {
        posts: { prerender: async () => [{}, { page: '2' }] as Record<string, string>[] },
        guide: { prerender: async () => [{ slug: 'a/b c' }] },
      },
    }
    expect((await enumerate(dynamic, true)).paths).toEqual(['/posts', '/posts/2', '/guide/a/b%20c'])
  })

  it('rejects an empty or dot segment in a splat value and a missing splat', async () => {
    const bad = (value: Record<string, string>) =>
      enumerate({ table: { g: '/g/*s' }, pages: { g: { prerender: async () => [value] } } }, true)
    await expect(bad({ s: 'a//b' })).rejects.toThrow("route 'g' (/g/*s): prerender() gave an empty segment for 's'")
    await expect(bad({ s: 'a/../b' })).rejects.toThrow("gave '..' for 's'")
    await expect(bad({})).rejects.toThrow("prerender() gave no 's'")
  })

  it('treats listed paths as filling optional and splat routes, so they are not warned about', async () => {
    const dynamic: PrerenderRoutes = {
      table: { posts: '/posts/:page?', guide: '/guide/*slug', both: '/x/:y/*z' },
      pages: { posts: {}, guide: {}, both: {} },
    }
    expect((await enumerate(dynamic, ['/posts', '/guide/a/b'])).warnings).toEqual([
      "prerender: skipped dynamic route 'both' (/x/:y/*z): it has no prerender()",
    ])
    expect((await enumerate(dynamic, ['/posts/2', '/guide/a', '/x/1/2/3'])).warnings).toEqual([])
    expect((await enumerate(dynamic, ['/guide'])).warnings).toContain(
      "prerender: skipped dynamic route 'guide' (/guide/*slug): it has no prerender()",
    )
  })
})
