import { type AtomStore, makeAtomStore } from '@sleekstack/core'
import { Store } from '@sleekstack/ui'
import { Effect, Either, Option, ParseResult, Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import { defineRecord, defineTransformation, field, readOnly, RecordNotFound, RecordRejected, ref } from '../index'
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
    expect(PostAgain.atom('1')).toBe(Post.atom('1'))
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

const Author = defineRecord('author', { fields: { id: Schema.String, name: Schema.String } })
const Count = defineTransformation('count', () => ({
  from: Schema.Number,
  to: Schema.NumberFromString,
  hydrate: (n: number) => Effect.succeed(String(n)),
  serialize: (input: string) => Effect.succeed(Number(input)),
  defaultValue: () => '0',
}))
const Article = defineRecord('article', {
  fields: {
    id: readOnly(Schema.String),
    title: Schema.String.pipe(Schema.minLength(1)),
    qty: field(Count),
    createdAt: readOnly(Schema.Date),
    author: readOnly(ref(() => Author)),
  },
})
const articleWire = { id: '1', title: 'a', qty: 2, createdAt: '2026-01-02T00:00:00.000Z', author: 'u1' }
const decodeChange = Schema.decodeUnknownEither(Article.change)

describe('readOnly fields and record.change', () => {
  it('a readOnly field is in the record and its schema, and out of the Draft and its change', async () => {
    const s = makeAtomStore()
    const pushed = await run(s, Article.push(articleWire))
    expect(Either.getOrThrow(pushed)).toMatchObject({ createdAt: new Date(articleWire.createdAt), author: 'u1' })
    expect(Object.keys(Article.schema.fields)).toEqual(['id', 'title', 'qty', 'createdAt', 'author'])
    const draft = Effect.runSync(Effect.provideService(Article.useDraft('1'), Store, s))
    expect(s.get(draft.value)).toEqual({ title: 'a', qty: '2' })
    expect(Effect.runSync(Effect.provideService(draft.toDto(), Store, s))).toEqual({ title: 'a', qty: 2 })
  })

  it('a readOnly ref field still resolves in related', async () => {
    const s = makeAtomStore()
    await run(s, Author.push({ id: 'u1', name: 'Ann' }))
    await run(s, Article.push(articleWire))
    expect(s.get(Article.related('1', 'author'))).toEqual(
      Option.some({ id: 'u1', value: Option.some({ id: 'u1', name: 'Ann' }) }),
    )
  })

  it('change drops unknown and read-only keys; a field(...) decodes through its wire form', () => {
    expect(decodeChange({ ...articleWire, extra: true })).toEqual(Either.right({ title: 'a', qty: 2 }))
  })

  it.each([
    ['missing', { qty: 2 }, 'title'],
    ['malformed', { title: 'a', qty: '2' }, 'qty'],
    ['refined out', { title: '', qty: 2 }, 'title'],
  ])('change fails with a ParseError naming a %s editable field', (_, body, key) => {
    const out = decodeChange(body)
    expect(Either.isLeft(out) && ParseResult.isParseError(out.left) && out.left.message).toContain(`["${key}"]`)
  })

  it('a record with no editable field has a change that accepts {}', () => {
    const Stamp = defineRecord('stamp', { fields: { id: Schema.String, at: readOnly(Schema.Date) } })
    expect(Schema.decodeUnknownEither(Stamp.change)({ id: 'x', at: 'y' })).toEqual(Either.right({}))
  })

  it('RecordNotFound and RecordRejected are tagged errors with their fields', () => {
    expect(new RecordNotFound({ type: 'article', id: '1' })).toMatchObject({ _tag: 'RecordNotFound', id: '1' })
    expect(new RecordRejected({ type: 'article', id: '1', message: 'no' })).toMatchObject({
      _tag: 'RecordRejected',
      type: 'article',
      message: 'no',
    })
  })
})
