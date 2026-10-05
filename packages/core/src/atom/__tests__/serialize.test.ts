import { describe, expect, it, vi } from 'vitest'
import { Effect, Schema } from 'effect'
import * as Atom from '../Atom'
import * as Result from '../Result'
import { dehydrate, hydrate, makeAtomStore } from '../AtomStore'
import { DuplicateAtomKey } from '../../errors'

const DateSchema = Schema.Date // Date <-> ISO string: proves encode/decode run

const counting = () => {
  const runs = { n: 0 }
  const atom = Atom.serializable.result(
    Atom.make(
      Effect.sync(() => {
        runs.n++
        return new Date(0)
      }),
    ),
    { key: 'when', schema: DateSchema },
  )
  return { runs, atom }
}

describe('serializable atoms', () => {
  it('round trips value, writable, result and derived-Effect atoms', () => {
    const value = Atom.serializable(
      Atom.make((_get) => new Date(5)),
      { key: 'v', schema: DateSchema },
    )
    const writable = Atom.serializable(Atom.make(1), { key: 'w', schema: Schema.Number })
    const result = Atom.serializable.result(Atom.make(Effect.succeed('r')), { key: 'r', schema: Schema.String })
    const derived = Atom.serializable.result(
      Atom.make((get) => Effect.succeed(get(writable) + 1)),
      { key: 'd', schema: Schema.Number },
    )
    const server = makeAtomStore()
    server.set(writable, 41)
    for (const a of [value, result, derived]) server.get(a as Atom.Atom<unknown>)
    const snapshot = JSON.parse(JSON.stringify(dehydrate(server)))
    expect(snapshot).toEqual({ v: new Date(5).toISOString(), w: 41, r: 'r', d: 42 })

    const client = makeAtomStore({ hydrate: snapshot })
    expect(client.get(value)).toEqual(new Date(5))
    expect(client.get(writable)).toBe(41)
    expect(client.get(result)).toEqual(Result.success('r'))
    expect(client.get(derived)).toEqual(Result.success(42))
  })

  it('result kind: dehydrates Success only; a seed runs the Effect zero times until refresh', () => {
    const failing = Atom.serializable.result(Atom.make(Effect.fail('no')), { key: 'f', schema: Schema.String })
    const server = makeAtomStore()
    server.get(failing)
    expect(dehydrate(server)).toEqual({})

    const { runs, atom } = counting()
    const client = makeAtomStore({ hydrate: { when: new Date(9).toISOString() } })
    expect(client.get(atom)).toEqual(Result.success(new Date(9)))
    expect(runs.n).toBe(0)
    client.refresh(atom)
    client.get(atom)
    expect(runs.n).toBe(1)
  })

  it('throws DuplicateAtomKey for a distinct atom with a built key; re-reading the same atom is fine', () => {
    const a = Atom.serializable(Atom.make(1), { key: 'k', schema: Schema.Number })
    const b = Atom.serializable(Atom.make(2), { key: 'k', schema: Schema.Number })
    const store = makeAtomStore()
    store.get(a)
    expect(store.get(a)).toBe(1)
    expect(() => store.get(b)).toThrow(DuplicateAtomKey)
  })

  it('keeps DuplicateAtomKey after the first atom is evicted idle; the same atom rebuilds fine', async () => {
    const a = Atom.serializable(Atom.make(1), { key: 'k', schema: Schema.Number })
    const b = Atom.serializable(Atom.make(2), { key: 'k', schema: Schema.Number })
    const store = makeAtomStore()
    store.get(a)
    await new Promise((r) => setTimeout(r, 0)) // idle node removed
    expect(store.inspect()).toEqual([])
    expect(() => store.get(b)).toThrow(DuplicateAtomKey)
    expect(store.get(a)).toBe(1)
  })

  it('ignores unknown keys, drops failed decodes with a warning, skips failed encodes, ignores non-object snapshots', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const n = Atom.serializable(Atom.make(7), { key: 'n', schema: Schema.Number })
    const store = makeAtomStore({ hydrate: { unknown: 1, n: 'not a number' } })
    expect(store.get(n)).toBe(7)
    expect(warn).toHaveBeenCalledTimes(1)

    const bad = Atom.serializable(Atom.make(-1), { key: 'pos', schema: Schema.Positive })
    store.get(bad)
    expect(dehydrate(store)).toEqual({ n: 7 })
    expect(warn).toHaveBeenCalledTimes(2)

    for (const s of [
      null,
      'x',
      [1],
      new Date(0),
      new Proxy(
        {},
        {
          ownKeys: () => {
            throw new Error('boom')
          },
        },
      ),
    ])
      expect(() => hydrate(store, s as never)).not.toThrow()
    expect(warn).toHaveBeenCalledTimes(7)
    warn.mockRestore()
  })

  it('dehydrate on a disposed store returns {}', async () => {
    const n = Atom.serializable(Atom.make(1), { key: 'n', schema: Schema.Number })
    const store = makeAtomStore()
    store.get(n)
    await store.dispose()
    expect(dehydrate(store)).toEqual({})
  })

  it('hydrate: identical snapshot no-op, first seed wins, built node never overwritten', () => {
    const a = Atom.serializable(Atom.make(0), { key: 'a', schema: Schema.Number })
    const b = Atom.serializable(Atom.make(0), { key: 'b', schema: Schema.Number })
    const store = makeAtomStore({ hydrate: { a: 1 } })
    hydrate(store, { a: 1 })
    hydrate(store, { a: 2 })
    expect(store.get(a)).toBe(1)
    store.get(b)
    hydrate(store, { b: 5 })
    expect(store.get(b)).toBe(0)
    const c = Atom.serializable(Atom.make(0), { key: 'c', schema: Schema.Number })
    store.retain(c)
    hydrate(store, { c: 5 })
    expect(store.get(c)).toBe(0)
  })

  it('round trips a `__proto__` key as an own entry', () => {
    const p = Atom.serializable(Atom.make(3), { key: '__proto__', schema: Schema.Number })
    const server = makeAtomStore()
    server.get(p)
    const snapshot = JSON.parse(JSON.stringify(dehydrate(server)))
    expect(Object.keys(snapshot)).toEqual(['__proto__'])
    expect(makeAtomStore({ hydrate: snapshot }).get(p)).toBe(3)
  })

  it('inert store: forks nothing, unseeded result stays Initial, seeds apply, sync atoms compute', () => {
    const { runs, atom } = counting()
    const other = Atom.serializable.result(
      Atom.make(
        Effect.sync(() => {
          runs.n++
          return 1
        }),
      ),
      { key: 'o', schema: Schema.Number },
    )
    const sync = Atom.make(() => 3)
    const store = makeAtomStore({ inert: true, hydrate: { o: 2 } })
    expect(Result.isInitial(store.get(atom))).toBe(true)
    expect(store.get(other)).toEqual(Result.success(2))
    expect(store.get(sync)).toBe(3)
    expect(runs.n).toBe(0)
  })
})
