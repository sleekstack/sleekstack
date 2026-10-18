import { type AtomStore, makeAtomStore } from '@sleekstack/core'
import { Store } from '@sleekstack/ui'
import { Effect, Option, Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import { defineRecord, type RecordDefinition, ref, type RefField, refs, type RefsField } from '../index'

// Post and Author point at each other: TypeScript needs the field types spelled out once to type the cycle.
type PostFields = {
  id: typeof Schema.String
  title: typeof Schema.String
  author: RefField<RecordDefinition<'author', AuthorFields>>
}
type AuthorFields = {
  id: typeof Schema.String
  name: typeof Schema.String
  posts: RefsField<RecordDefinition<'post', PostFields>>
}
const Post: RecordDefinition<'post', PostFields> = defineRecord('post', {
  fields: { id: Schema.String, title: Schema.String, author: ref(() => Author) },
})
const Author: RecordDefinition<'author', AuthorFields> = defineRecord('author', {
  fields: { id: Schema.String, name: Schema.String, posts: refs(() => Post) },
})

const push = <A, E>(s: AtomStore, e: Effect.Effect<A, E, Store>) =>
  Effect.runPromise(Effect.provideService(e, Store, s))
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('relationships', () => {
  it('a related atom follows both the owner and the target record', async () => {
    const s = makeAtomStore()
    const author = Post.related('p1', 'author')
    const seen: Array<unknown> = []
    s.subscribe(author, () => seen.push(s.get(author)))
    await push(s, Author.push({ id: 'a1', name: 'Ann', posts: [] }))
    await push(s, Author.push({ id: 'a2', name: 'Bob', posts: [] }))
    await push(s, Post.push({ id: 'p1', title: 't', author: 'a1' }))
    await push(s, Author.push({ id: 'a1', name: 'Ann B', posts: [] }))
    await push(s, Post.push({ id: 'p1', title: 't', author: 'a2' }))
    await push(s, Post.push({ id: 'p1', title: 't', author: null }))
    expect(seen).toEqual([
      Option.some({ id: 'a1', value: Option.some({ id: 'a1', name: 'Ann', posts: [] }) }),
      Option.some({ id: 'a1', value: Option.some({ id: 'a1', name: 'Ann B', posts: [] }) }),
      Option.some({ id: 'a2', value: Option.some({ id: 'a2', name: 'Bob', posts: [] }) }),
      Option.some(null),
    ])
  })

  it('a missing target keeps its id and position and fills in when pushed later', async () => {
    const s = makeAtomStore()
    const posts = Author.related('a1', 'posts')
    const seen: Array<unknown> = []
    s.subscribe(posts, () => seen.push(s.get(posts)))
    await push(s, Post.push({ id: 'p2', title: 'two', author: 'a1' }))
    await push(s, Author.push({ id: 'a1', name: 'Ann', posts: ['p2', 'p1', 'p2'] }))
    const p2 = Option.some({ id: 'p2', title: 'two', author: 'a1' })
    expect(s.get(posts)).toEqual(
      Option.some([
        { id: 'p2', value: p2 },
        { id: 'p1', value: Option.none() },
        { id: 'p2', value: p2 },
      ]),
    )
    // A late push re-runs the subscribed chain (related, then the record reader, then the slot).
    await push(s, Post.push({ id: 'p1', title: 'one', author: 'a1' }))
    expect(seen.at(-1)).toEqual(
      Option.some([
        { id: 'p2', value: p2 },
        { id: 'p1', value: Option.some({ id: 'p1', title: 'one', author: 'a1' }) },
        { id: 'p2', value: p2 },
      ]),
    )
  })

  it('reading a relationship starts no request: the value is synchronous and nothing fills it', async () => {
    const s = makeAtomStore()
    await push(s, Post.push({ id: 'p1', title: 't', author: 'a1' }))
    expect(s.get(Post.related('p1', 'author'))).toEqual(Option.some({ id: 'a1', value: Option.none() }))
    expect(s.get(Post.related('p9', 'author'))).toEqual(Option.none())
    await tick()
    expect(s.get(Author.atom('a1'))).toEqual(Option.none())
  })

  it('a cyclic definition (post to author to post) reads without looping', async () => {
    const s = makeAtomStore()
    await push(s, Post.push({ id: 'p1', title: 't', author: 'a1' }))
    await push(s, Author.push({ id: 'a1', name: 'Ann', posts: ['p1'] }))
    const back = Option.flatMap(s.get(Post.related('p1', 'author')), (a) => (a === null ? Option.none() : a.value))
    const posts = Option.flatMap(back, (a) => s.get(Author.related(a.id, 'posts')))
    expect(posts).toEqual(Option.some([{ id: 'p1', value: Option.some({ id: 'p1', title: 't', author: 'a1' }) }]))
  })

  it('related(id, field) returns the same atom on every call, and only for a relationship field', () => {
    expect(Post.related('p1', 'author')).toBe(Post.related('p1', 'author'))
    expect(Post.related('p1', 'author')).not.toBe(Post.related('p2', 'author'))
    expect(() => Post.related('p1', 'title' as never)).toThrow(TypeError)
  })
})
