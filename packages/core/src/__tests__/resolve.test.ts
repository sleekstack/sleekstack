import { describe, expect, it } from 'vitest'
import { Context, Effect, Either } from 'effect'
import { buildGraph, makeAppScope, module, resolveTag, resolveTagEffect, service } from '../index'

class Db extends Context.Tag('Db')<Db, number>() {}
class Pub extends Context.Tag('Pub')<Pub, number>() {}
class Nope extends Context.Tag('Nope')<Nope, number>() {}

const Data = module({ name: 'Data', entries: [service(Db, {}, () => Effect.succeed(1)), service(Pub, {}, () => Effect.succeed(2))], exports: [Pub] })

describe('Tag resolution (resolveTag / resolveTagEffect)', async () => {
  const app = await Effect.runPromise(makeAppScope(buildGraph([Data])))
  const child = await Effect.runPromise(app.child('component', [service(Pub, { lifetime: 'component' }, () => Effect.succeed(20))]))

  it.each([
    ['public', app, Pub, { ok: 2 }],
    ['shadowed', child, Pub, { ok: 20 }],
    ['private', app, Db, { err: { _tag: 'PrivateDependency', tag: 'Db', module: 'Data', requiredBy: 'who', message: '"who" requires "Db", which is private to module "Data" (not in its exports)' } }],
    ['missing', app, Nope, { err: { _tag: 'MissingDependency', tag: 'Nope', service: 'who', missing: 'Nope', message: '"who" requires "Nope", which is not provided' } }],
  ] as const)('%s', (_, scope, tag, want) => {
    const eff = Effect.runSync(Effect.either(Effect.provide(resolveTagEffect(tag, 'who'), scope.context)))
    if ('ok' in want) {
      expect(resolveTag(scope.context, tag, 'who')).toBe(want.ok)
      expect(eff).toEqual(Either.right(want.ok))
    } else {
      expect(() => resolveTag(scope.context, tag, 'who')).toThrow(expect.objectContaining(want.err))
      expect(Either.isLeft(eff) && eff.left).toMatchObject(want.err)
    }
  })
})
