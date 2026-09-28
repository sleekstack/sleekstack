import { afterEach, describe, expect, it, vi } from 'vitest'
import { Cause, Context, Data, Deferred, Effect, Stream } from 'effect'
import { Atom, AtomCycle, makeAtomStore, Result } from '../index'

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('Atom + AtomStore: derivation', () => {
  it('recomputes only on change; a diamond computes each node once per change', () => {
    const store = makeAtomStore()
    const a = Atom.make(1)
    let bRuns = 0, cRuns = 0, dRuns = 0, parityRuns = 0
    const b = Atom.make((get) => { bRuns++; return get(a) + 1 })
    const c = Atom.make((get) => { cRuns++; return get(a) * 2 })
    const d = Atom.make((get) => { dRuns++; return get(b) + get(c) })
    const parity = Atom.make((get) => get(a) % 2)
    const afterParity = Atom.make((get) => { parityRuns++; return get(parity) })
    const seen: number[] = []
    store.subscribe(d, () => seen.push(store.get(d)))
    store.mount(afterParity)
    expect([bRuns, cRuns, dRuns, parityRuns]).toEqual([1, 1, 1, 1])
    store.set(a, 3)
    expect([bRuns, cRuns, dRuns]).toEqual([2, 2, 2])
    expect(parityRuns).toBe(1) // parity unchanged (1 -> 1): downstream not recomputed
    expect(seen).toEqual([10])
    store.set(a, 3) // equal value: nothing recomputes
    expect(dRuns).toBe(2)
  })

  it('batch notifies once with no torn reads', () => {
    const store = makeAtomStore()
    const x = Atom.make(1)
    const y = Atom.make(1)
    const sum = Atom.make((get) => get(x) + get(y))
    const seen: number[] = []
    store.subscribe(sum, () => seen.push(store.get(sum)))
    store.batch(() => { store.set(x, 2); store.set(y, 3) })
    expect(seen).toEqual([5])
    store.update(x, (n) => n + 1)
    expect(seen).toEqual([5, 6])
  })

  it('writable(read, write) routes writes', () => {
    const store = makeAtomStore()
    const base = Atom.make(1)
    const doubled = Atom.writable((get) => get(base) * 2, (ctx, v: number) => ctx.set(base, v / 2))
    store.mount(doubled)
    store.set(doubled, 10)
    expect(store.get(base)).toBe(5)
    expect(store.get(doubled)).toBe(10)
  })

  it('a read cycle throws AtomCycle naming the atoms', () => {
    const store = makeAtomStore()
    const p: Atom.Atom<number> = Atom.make((get): number => get(q))
    const q: Atom.Atom<number> = Atom.make((get): number => get(p))
    let err: unknown
    try { store.get(p) } catch (e) { err = e }
    expect(err).toBeInstanceOf(AtomCycle)
    expect((err as AtomCycle).path).toEqual([p.label, q.label, p.label])
    expect((err as AtomCycle).message).toContain(`${p.label} -> ${q.label}`)
  })
})

describe('Effect and Stream atoms', () => {
  it('an Effect failure gives Failure with its Cause', () => {
    const store = makeAtomStore()
    const r = store.get(Atom.make(Effect.fail('boom')))
    expect(Result.isFailure(r) && Cause.isFailType(r.cause) && r.cause.error).toBe('boom')
  })

  it('runs with the store context; refresh keeps the previous value waiting; invalidation interrupts', async () => {
    class N extends Context.Tag('N')<N, number>() {}
    const store = makeAtomStore({ context: Context.make(N, 7) })
    let interrupted = 0
    let gate = Deferred.unsafeMake<void>(undefined as never)
    const atom = Atom.make(
      Effect.gen(function* () {
        const n = yield* N
        yield* Deferred.await(gate)
        return n
      }).pipe(Effect.onInterrupt(() => Effect.sync(() => { interrupted++ }))),
    )
    store.mount(atom)
    expect(store.get(atom)).toEqual(Result.initial(true))
    Effect.runSync(Deferred.succeed(gate, undefined))
    await tick()
    expect(store.get(atom)).toEqual(Result.success(7))
    gate = Deferred.unsafeMake<void>(undefined as never)
    store.refresh(atom)
    expect(store.get(atom)).toEqual(Result.success(7, { waiting: true }))
    store.refresh(atom) // in-flight build is interrupted
    await tick()
    expect(interrupted).toBe(1)
  })

  it('a Stream atom holds the latest element', async () => {
    const store = makeAtomStore()
    const atom = Atom.make(Stream.make(1, 2, 3))
    const empty = Atom.make(Stream.empty)
    store.mount(atom); store.mount(empty)
    await tick()
    expect(store.get(atom)).toEqual(Result.success(3))
    expect(Result.isFailure(store.get(empty))).toBe(true)
  })
})

describe('family', () => {
  it('an equal structural key returns the same atom', () => {
    const fam = Atom.family((k: { id: number }) => Atom.make(k.id))
    expect(fam(Data.struct({ id: 1 }))).toBe(fam(Data.struct({ id: 1 })))
    expect(fam(Data.struct({ id: 1 }))).not.toBe(fam(Data.struct({ id: 2 })))
    const byString = Atom.family((k: string) => Atom.make(k))
    expect(byString('a')).toBe(byString('a'))
  })

  it('falls back to a Map without WeakRef/FinalizationRegistry', () => {
    vi.stubGlobal('WeakRef', undefined)
    vi.stubGlobal('FinalizationRegistry', undefined)
    const fam = Atom.family((k: string) => Atom.make(k))
    expect(fam('x')).toBe(fam('x'))
  })
})

describe('lifecycle', () => {
  const tracked = () => {
    let finalized = 0
    const atom = Atom.make((get) => { get.addFinalizer(() => { finalized++ }); return 1 })
    return { atom, finalized: () => finalized }
  }

  it('removes an unsubscribed node after a microtask; resubscribing in the same tick keeps it', async () => {
    const store = makeAtomStore()
    const t = tracked()
    const unsub = store.subscribe(t.atom, () => {})
    unsub()
    const unsub2 = store.subscribe(t.atom, () => {})
    await tick()
    expect(t.finalized()).toBe(0)
    unsub2()
    await tick()
    expect(t.finalized()).toBe(1)
  })

  it('idleTTL delays removal, keepAlive persists, retain holds until released', () => {
    vi.useFakeTimers()
    const store = makeAtomStore({ scheduleTask: (f) => setTimeout(f, 0) })
    const ttl = tracked()
    store.subscribe(Atom.setIdleTTL(ttl.atom, 100), () => {})()
    vi.advanceTimersByTime(60)
    expect(ttl.finalized()).toBe(0)
    vi.advanceTimersByTime(200)
    expect(ttl.finalized()).toBe(1)

    let kept = 0
    const alive = Atom.keepAlive(Atom.make((get) => { get.addFinalizer(() => { kept++ }); return 1 }))
    store.get(alive)
    vi.advanceTimersByTime(1000)
    expect(kept).toBe(0)

    const held = tracked()
    const release = store.retain(held.atom)
    store.get(held.atom)
    vi.advanceTimersByTime(1000)
    expect(held.finalized()).toBe(0)
    release()
    vi.advanceTimersByTime(1)
    expect(held.finalized()).toBe(1)
  })

  it('dispose interrupts all, runs finalizers, and reports finalizer failures', async () => {
    const errors: unknown[] = []
    const store = makeAtomStore({ onFinalizerError: (e) => errors.push(e) })
    let interrupted = false
    const running = Atom.make(Effect.never.pipe(Effect.onInterrupt(() => Effect.sync(() => { interrupted = true }))))
    const failing = Atom.make(Effect.addFinalizer(() => Effect.die('fin-boom')).pipe(Effect.zipRight(Effect.never)))
    const sync = Atom.make((get) => { get.addFinalizer(() => { throw new Error('sync-boom') }); return 1 })
    store.mount(running); store.mount(failing); store.mount(sync)
    await store.dispose()
    expect(interrupted).toBe(true)
    expect(errors.map(String)).toEqual(expect.arrayContaining(['Error: sync-boom', 'fin-boom']))
  })
})

describe('review regressions', () => {
  it('a write before the first read keeps dependency tracking', () => {
    const store = makeAtomStore()
    const base = Atom.make(1)
    const w = Atom.writable((get) => get(base) * 2, (ctx, v: number) => ctx.setSelf(v))
    store.set(w, 10)
    store.mount(w)
    store.set(base, 4)
    expect(store.get(w)).toBe(8)
  })

  it('a derived atom that caught a parent error, and subscribers past a throwing node, see recovery', () => {
    const store = makeAtomStore()
    const input = Atom.make(0)
    const risky = Atom.make((get) => { if (get(input) === 0) throw new Error('zero'); return get(input) })
    const safe = Atom.make((get) => { try { return get(risky) } catch { return -1 } })
    const mid = Atom.make((get) => get(risky) + 1)
    const after = Atom.make((get) => get(mid))
    const seen: number[] = []
    const read = (atom: Atom.Atom<number>) => () => { try { seen.push(store.get(atom)) } catch { /* error state */ } }
    store.subscribe(safe, read(safe))
    store.subscribe(after, read(after))
    expect(store.get(safe)).toBe(-1)
    store.set(input, 42)
    store.set(input, 0) // throws again through the chain
    store.set(input, 2)
    expect(seen.slice(0, 2)).toEqual([42, 43])
    expect(seen.slice(-2)).toEqual([2, 3])
  })

  it('dependency invalidation interrupts retained and keepAlive Effect builds', () => {
    const store = makeAtomStore()
    const dep = Atom.make(0)
    let interrupted = 0
    const mk = () => Atom.make((get) => { get(dep); return Effect.never.pipe(Effect.onInterrupt(() => Effect.sync(() => { interrupted++ }))) })
    const retained = mk()
    store.retain(retained)
    store.get(retained)
    store.get(Atom.keepAlive(mk()))
    store.set(dep, 1)
    return new Promise<void>((r) => setTimeout(r, 0)).then(() => expect(interrupted).toBe(2))
  })

  it('reports failing ensuring cleanup of an interrupted fiber', async () => {
    const errors: unknown[] = []
    const store = makeAtomStore({ onFinalizerError: (e) => errors.push(e) })
    store.mount(Atom.make(Effect.never.pipe(Effect.ensuring(Effect.die('release-failed')))))
    const ok = Atom.make(Effect.fail('plain'))
    store.mount(ok) // completed failure: not a finalizer error
    await store.dispose()
    expect(errors).toEqual(['release-failed'])
  })

  it('an empty Stream after refresh keeps the previous value', async () => {
    const store = makeAtomStore()
    let empty = false
    const atom = Atom.make(() => (empty ? Stream.empty : Stream.succeed(42)))
    store.mount(atom)
    await tick()
    empty = true
    store.refresh(atom)
    await tick()
    const r = store.get(atom)
    expect(Result.isFailure(r) && r.previousValue).toEqual(Result.value(Result.success(42)))
  })

  it('a write after refresh in a batch wins', () => {
    const store = makeAtomStore()
    const atom = Atom.make(1)
    const seen: number[] = []
    store.subscribe(atom, () => seen.push(store.get(atom)))
    store.batch(() => { store.refresh(atom); store.set(atom, 2) })
    expect(seen).toEqual([2])
  })
})
