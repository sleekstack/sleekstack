import { Cause, Context, Effect, Exit, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { accessors, Controller, type Gen, Service } from '../index'

class Db extends Context.Tag('test/Db')<Db, { readonly rows: ReadonlyArray<string> }>() {}
const db = Layer.succeed(Db, { rows: ['a', 'b'] })

// An intermediate class: `Rows` inherits `first`.
class Shared extends Service<Rows>()('test/Rows', { db: Db }) {
  *first() {
    return this.db.rows[0]
  }
}

class Rows extends Shared {
  *all(): Gen<ReadonlyArray<string>> {
    return this.db.rows
  }

  *count() {
    return (yield* this.all()).length
  }

  *span() {
    return (yield* Effect.currentSpan).name
  }

  plain() {
    return 'plain'
  }
}

const run = <A, E>(effect: Effect.Effect<A, E, Rows>) =>
  Effect.runPromise(effect.pipe(Effect.provide(Rows.Default.pipe(Layer.provide(db)))))

describe('Service', () => {
  it('builds Default from the declared Tags and is its own Tag', async () => {
    const rows = await run(Rows)
    expect(rows.db.rows).toEqual(['a', 'b'])
    expect(rows).toBeInstanceOf(Rows)
  })

  it('runs generator methods as spanned Effects, internal and inherited calls included', async () => {
    expect(await run(accessors(Rows).count())).toBe(2)
    expect(await run(accessors(Rows).first())).toBe('a')
    expect(await run(accessors(Rows).span())).toBe('test/Rows.span')
  })

  it('leaves a non-generator method alone', async () => {
    expect((await run(Rows)).plain()).toBe('plain')
  })

  it('may depend on another Service', async () => {
    class Report extends Service<Report>()('test/Report', { rows: Rows }) {
      *summary() {
        return `${yield* this.rows.count()} rows`
      }
    }
    const layer = Report.Default.pipe(Layer.provide(Rows.Default), Layer.provide(db))
    expect(await Effect.runPromise(accessors(Report).summary().pipe(Effect.provide(layer)))).toBe('2 rows')
  })

  it.each([
    [
      'a declared name equal to a method',
      () =>
        class extends Service<unknown>()('test/Collide', { db: Db }) {
          // @ts-expect-error the type checker refuses the collision too
          *db() {}
        }.Default,
      /collides/,
    ],
    [
      'a declared name constructor',
      () => class extends Service<unknown>()('test/Ctor', { constructor: Db }) {}.Default,
      /collides/,
    ],
    ['a duplicate key', () => Service<unknown>()('test/Rows'), /already used/],
  ])('is a defect for %s', (_, define, message) => {
    expect(define).toThrow(message)
  })
})

class Viewer extends Context.Tag('test/Viewer')<Viewer, { readonly name: string }>() {}

let built = 0

class Hello extends Controller({ viewer: Viewer }) {
  readonly at = ++built;

  *GET(input: { readonly params: { readonly id: string } }): Gen<string> {
    return `${yield* this.greet()} ${input.params.id} #${this.at}`
  }

  *greet() {
    return `hello ${this.viewer.name}`
  }
}

const viewer = (name: string) => Effect.provideService(Viewer, { name })

// A Controller Method's `run` is typed loosely, as the generated entry holds it.
const exec = (effect: Effect.Effect<unknown, unknown, unknown>) =>
  Effect.runPromiseExit(effect as Effect.Effect<unknown>)
const value = async (effect: Effect.Effect<unknown, unknown, unknown>) =>
  Exit.getOrElse(await exec(effect), () => undefined)

describe('Controller', () => {
  it('builds an instance per request from a Tag the surrounding Effect provides, with this bound', async () => {
    const get = Hello.run('GET')
    const first = String(await value(viewer('ada')(get({ params: { id: '1' } }))))
    const second = String(await value(viewer('bob')(get({ params: { id: '2' } }))))
    expect(first).toMatch(/^hello ada 1 #\d+$/)
    expect(second).toMatch(/^hello bob 2 #\d+$/)
    expect(first.split('#')[1]).not.toBe(second.split('#')[1])
  })

  it('wraps each generator method once per class', () => {
    const a = new Hello({ viewer: { name: 'a' } })
    const b = new Hello({ viewer: { name: 'b' } })
    expect(a.GET).toBe(b.GET)
  })

  it('spans a method by the class name', async () => {
    class Spanned extends Controller() {
      *GET(): Gen<string, Cause.NoSuchElementException> {
        return (yield* Effect.currentSpan).name
      }
    }
    expect(await value(Spanned.run('GET')(undefined))).toBe('Spanned.GET')
  })

  it('accepts Controller({})', async () => {
    class Empty extends Controller({}) {
      *POST(): Gen<number> {
        return 1
      }
    }
    expect(await value(Empty.run('POST')({}))).toBe(1)
  })

  it('fails the request on a missing declared Tag', async () => {
    const exit = await exec(Hello.run('GET')({ params: { id: '1' } }))
    expect(Exit.isFailure(exit) && Cause.isDie(exit.cause)).toBe(true)
  })

  it.each([
    ['an HTTP method', () => class extends Controller({ GET: Viewer }) {}.run('GET' as never)],
    [
      'a method of the class',
      () =>
        class extends Controller({ greet: Viewer }) {
          *GET() {}
          // @ts-expect-error the type checker refuses the collision too
          *greet() {}
        }.run('GET'),
    ],
  ])('is a defect for a declared name equal to %s', (_, define) => {
    expect(define).toThrow(/collides/)
  })
})
