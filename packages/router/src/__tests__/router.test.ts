import { Effect, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { el, Provide, renderToString } from '@sleekstack/ui'
import { match, params, Route, routeLayer, routes } from '../index'

const table = routes({ home: '/', user: '/users/:id', post: '/users/:id/posts/:post' })

describe('match', () => {
  it.each([
    ['/', 'home', {}],
    ['/users/a%20b', 'user', { id: 'a b' }],
    ['/users/1/posts/2/', 'post', { id: '1', post: '2' }],
  ])('%s matches %s', (pathname, name, ps) => {
    expect(Option.getOrThrow(match(table, pathname))).toMatchObject({ name, params: ps, pathname })
  })

  it('no route matches an unknown path', () => {
    expect(Option.isNone(match(table, '/users/1/x'))).toBe(true)
  })
})

describe('Route layer', () => {
  it('the page reads the matched route as a service', async () => {
    const page = Effect.gen(function* () {
      const route = yield* Route
      const { id } = yield* params(table, 'user')
      return el('p', {}, `${route.name}:${id}`)
    })
    const m = Option.getOrThrow(match(table, '/users/7'))
    expect(await renderToString(Provide(routeLayer(m), page), { layer: routeLayer(m) })).toContain('<p>user:7</p>')
  })

  it('params for another route is a defect', async () => {
    const m = Option.getOrThrow(match(table, '/'))
    const exit = await Effect.runPromiseExit(Effect.provide(params(table, 'user'), routeLayer(m)))
    expect(exit._tag).toBe('Failure')
  })
})
