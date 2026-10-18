import { type AtomStore, makeAtomStore } from '@sleekstack/core'
import { Store } from '@sleekstack/ui'
import { Effect, Either, Option, ParseResult, Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import { defineRecord } from '../index'
import { slotOf } from '../registry'

const Post = defineRecord('post', {
  fields: { id: Schema.String, title: Schema.String, likes: Schema.NumberFromString },
})
// A second definition of the same type, as another module might make.
const PostAgain = defineRecord('post', {
  fields: { id: Schema.String, title: Schema.String, likes: Schema.NumberFromString },
})

const run = <A, E>(s: AtomStore, e: Effect.Effect<A, E, Store>) =>
  Effect.runPromise(Effect.either(Effect.provideService(e, Store, s)))
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('defineRecord', () => {
  it('pushes of one type and id from two sources share one atom and one value', async () => {
    const s = makeAtomStore()
    await run(s, Post.push({ id: '1', title: 'a', likes: '1' }))
    await run(s, PostAgain.push({ id: '1', title: 'b', likes: '2' }))
    expect(Post.atom('1')).toBe(Post.atom('1'))
    expect(s.get(Post.atom('1'))).toEqual(Option.some({ id: '1', title: 'b', likes: 2 }))
    expect(s.get(PostAgain.atom('1'))).toEqual(s.get(Post.atom('1')))
    expect(s.get(Post.atom('2'))).toEqual(Option.none())
  })

  it('keeps a record nobody reads past a microtask turn', async () => {
    const s = makeAtomStore()
    await run(s, Post.push({ id: '1', title: 'a', likes: '1' }))
    await tick()
    await tick()
    expect(s.get(Post.atom('1'))).toEqual(Option.some({ id: '1', title: 'a', likes: 1 }))
  })

  it('evict then push reuses the atom and shows the new value', async () => {
    const s = makeAtomStore()
    const seen: Array<unknown> = []
    const atom = Post.atom('1')
    const slot = slotOf(s, 'post', '1')
    s.subscribe(atom, () => seen.push(s.get(atom)))
    await run(s, Post.push({ id: '1', title: 'a', likes: '1' }))
    await run(s, Post.evict('1'))
    expect(s.get(atom)).toEqual(Option.none())
    await run(s, Post.push({ id: '1', title: 'c', likes: '3' }))
    expect(slotOf(s, 'post', '1')).toBe(slot)
    expect(Post.atom('1')).toBe(atom)
    expect(seen).toEqual([
      Option.some({ id: '1', title: 'a', likes: 1 }),
      Option.none(),
      Option.some({ id: '1', title: 'c', likes: 3 }),
    ])
  })

  it('a decode failure is a typed ParseError and leaves the previous value', async () => {
    const s = makeAtomStore()
    await run(s, Post.push({ id: '1', title: 'a', likes: '1' }))
    const out = await run(s, Post.push({ id: '1', title: 'b', likes: 'many' }))
    expect(Either.isLeft(out) && ParseResult.isParseError(out.left)).toBe(true)
    expect(s.get(Post.atom('1'))).toEqual(Option.some({ id: '1', title: 'a', likes: 1 }))
  })

  it('a slot has no ackedAt until a save is acknowledged', async () => {
    const s = makeAtomStore()
    await run(s, Post.push({ id: '1', title: 'a', likes: '1' }))
    expect(s.get(slotOf(s, 'post', '1')).ackedAt).toEqual(Option.none())
  })

  it('disposing the Store releases the registry and its records', async () => {
    const s = makeAtomStore()
    await run(s, Post.push({ id: '1', title: 'a', likes: '1' }))
    expect(s.inspect().length).toBeGreaterThan(0)
    await s.dispose()
    expect(s.inspect()).toEqual([])
    const fresh = makeAtomStore()
    expect(fresh.get(Post.atom('1'))).toEqual(Option.none())
  })
})
