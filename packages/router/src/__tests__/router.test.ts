import { Effect, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { el, Provide, renderToString } from '@sleekstack/ui'
import { match, params, Route, routeLayer, routes } from '../index'

const table = routes({
  home: '/',
  cafe: '/café',
  file: '/item:format',
  proto: '/p/:__proto__',
  user: '/users/:id',
  post: '/users/:id/posts/:post',
  optional: '/u/:id?',
  files: '/files/*path',
  midOptional: '/m/:x?/y',
  midSplat: '/s/*x/y',
})

describe('match', () => {
  it.each([
    ['/', 'home', {}],
    ['/users/a%20b', 'user', { id: 'a b' }],
    ['/users/1/posts/2/', 'post', { id: '1', post: '2' }],
    ['/caf%C3%A9', 'cafe', {}],
    ['/item:format', 'file', {}],
    ['/u/7', 'optional', { id: '7' }],
    ['/files/a', 'files', { path: 'a' }],
    ['/files/a/b%20c/d/', 'files', { path: 'a/b c/d' }],
    ['/files/a%2Fb', 'files', { path: 'a/b' }],
  ])('%s matches %s', (pathname, name, ps) => {
    expect(Option.getOrThrow(match(table, pathname))).toMatchObject({ name, params: ps, pathname })
  })

  it.each([
    '/users/1/x',
    '/users/%',
    '/users/%ZZ',
    '/users//7',
    '/users/',
    '/u/7/8',
    '/u//',
    '/files',
    '/files/',
    '/files/a//b',
    '/files/a/%ZZ',
    '/m/1/y',
    '/s/*x/y',
  ])('%s matches no route', (pathname) => {
    expect(Option.isNone(match(table, pathname))).toBe(true)
  })

  it.each(['/u', '/u/'])('%s matches the optional route with no param', (pathname) => {
    const m = Option.getOrThrow(match(table, pathname))
    expect(m.name).toBe('optional')
    expect('id' in m.params).toBe(false)
  })

  it('a reserved name is an own param', () => {
    expect(Object.getOwnPropertyDescriptor(Option.getOrThrow(match(table, '/p/x')).params, '__proto__')?.value).toBe(
      'x',
    )
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
