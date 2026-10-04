import { Atom, makeAtomStore, MissingDependency } from '@sleekstack/core'
import { Context, Data, Effect, Exit, Layer, Scope } from 'effect'
import { describe, expect, it } from 'vitest'
import { el, Provider, renderToString, SlotMismatch, Store, useAtom, useAtomValue, useLocal } from '../index'
import { Fragment, jsx as rawJsx } from '../jsx-runtime'
import { commitSlots, dropSlots, Frame, makeFrame, RenderScope } from '../reactive'

// `jsx` as compiled JSX calls it: component types are checked by `sleekstack check`, not tsc.
const jsx = (type: any, props: any, key?: string | number) => rawJsx(type, props, key)

const count = Atom.make(3)
class Greeting extends Context.Tag('Greeting')<Greeting, string>() {}
class Boom extends Data.TaggedError('Boom')<{}> {}

const Counter = () => Effect.map(useAtomValue(count), (n) => el('b', {}, String(n)))

describe('reactive components', () => {
  it('renders the current atom value with no wrapper element', async () => {
    expect(await renderToString(jsx(Counter, {}), { layer: Layer.empty })).toBe('<b>3</b>')
  })

  it('returns a Reactive node only when atoms were read', async () => {
    const node = await Effect.runPromise(Effect.provideService(jsx(Counter, {}), Store, makeAtomStore()))
    expect(node._tag).toBe('Reactive')
    const plain = await Effect.runPromise(jsx(() => Effect.succeed(el('p')), {}))
    expect(plain).toEqual(el('p'))
  })

  it('rejects a first-render failure with the original tagged error', async () => {
    const boom = new Boom()
    const Failing = () => Effect.flatMap(useAtomValue(count), () => Effect.fail(boom))
    await expect(renderToString(jsx(Failing, {}), { layer: Layer.empty })).rejects.toBe(boom)
  })

  it('sees an enclosing Provider layer', async () => {
    const Hi = () => Effect.zipWith(Greeting, useAtom(count), (g, [n]) => el('p', {}, `${g} ${n}`))
    const app = jsx(Provider, { layer: Layer.succeed(Greeting, 'hi'), children: jsx(Hi, {}) })
    expect(await renderToString(app, { layer: Layer.empty })).toBe('<p>hi 3</p>')
  })

  it('keeps a scoped Provider layer alive for re-runs; closing a superseded run scope releases it', async () => {
    const log: Array<string> = []
    const layer = Layer.scoped(Greeting, Effect.acquireRelease(Effect.succeed('hi'), () => Effect.sync(() => log.push('released'))))
    const Hi = () => Effect.zipWith(Greeting, useAtomValue(count), (g, n) => el('p', {}, `${g} ${n}`))
    const Outer = () => Effect.flatMap(useAtomValue(count), () => jsx(Provider, { layer, children: jsx(Hi, {}) }))
    const scope = Effect.runSync(Scope.make())
    const node = await Effect.runPromise(
      jsx(Outer, {}).pipe(Effect.provideService(Store, makeAtomStore()), Effect.provideService(RenderScope, scope)),
    )
    if (node._tag !== 'Reactive') throw new Error('expected a reactive node')
    expect(log).toEqual([])
    const next = await Effect.runPromise(node.rerun)
    if (next._tag !== 'Reactive') throw new Error('expected a reactive node')
    // The owner (the DOM renderer) closes a superseded run's scope once the new DOM commits.
    expect(log).toEqual([])
    await Effect.runPromise(Scope.close(node.scope!, Exit.void))
    expect(log).toEqual(['released'])
    await Effect.runPromise(Scope.close(scope, Exit.void))
    expect(log).toEqual(['released', 'released'])
  })

  it('fails with a tagged error naming Store without a store; untracked on a direct call', async () => {
    const err = await Effect.runPromise(Effect.flip(useAtomValue(count) as unknown as Effect.Effect<number, unknown>))
    expect(err).toBeInstanceOf(MissingDependency)
    expect((err as MissingDependency).missing).toBe('Store')
    expect(await renderToString(Counter(), { layer: Layer.empty })).toBe('<b>3</b>')
  })

  it('rejects a user-built sleek-reactive element', async () => {
    await expect(renderToString(Effect.succeed(el('sleek-reactive')), { layer: Layer.empty })).rejects.toThrow(TypeError)
  })

  describe('instance identity', () => {
    const store = makeAtomStore()
    const run = (e: Effect.Effect<any, any, any>) => Effect.runPromise(Effect.provideService(e, Store, store) as Effect.Effect<any>)
    const A = () => Effect.map(useAtomValue(count), (n) => el('i', {}, String(n)))
    const ids = (n: any): Array<string> => (n._tag === 'Reactive' ? [n.id, ...ids(n.child)] : (n.children ?? []).flatMap((c: any) => (typeof c === 'string' ? [] : ids(c))))
    const Parent = ({ cond }: { cond: boolean }) => jsx(Fragment, { children: [cond && jsx(A, {}), jsx(A, {}), jsx(A, {}, 'k')] })

    it('ids are stable across runs; ordinal counts every call (positional shift)', async () => {
      const on = ids(await run(jsx(Parent, { cond: true })))
      expect(ids(await run(jsx(Parent, { cond: true })))).toEqual(on)
      const off = ids(await run(jsx(Parent, { cond: false })))
      const fn = on[0]!.split('#')[0]
      expect(on).toEqual([`${fn}#0`, `${fn}#1`, `${fn}:key:k`])
      expect(off).toEqual([`${fn}#0`, `${fn}:key:k`])
    })

    it('a self rerun keeps its id and leaves parent ordinals alone', async () => {
      const node: any = await run(jsx(Parent, { cond: true }, 'p'))
      const first = node.child.children[0]
      const again: any = await Effect.runPromise(first.rerun)
      expect(again.id).toBe(first.id)
      await Effect.runPromise(first.rerun)
      expect(ids(await Effect.runPromise(node.rerun))).toEqual(ids(node))
    })

    it('a keyed component that reads no atoms is still a Reactive node', async () => {
      const node: any = await run(jsx(() => Effect.succeed(el('p')), {}, 7))
      expect(node).toMatchObject({ _tag: 'Reactive', atoms: [], seen: [], key: '7' })
      expect(node.id).toMatch(/:key:7$/)
    })
  })

  describe('useLocal', () => {
    const run = (e: Effect.Effect<any, any, any>, store = makeAtomStore(), frame = makeFrame()) =>
      Effect.runPromise(e.pipe(Effect.provideService(Store, store), Effect.provideService(Frame, frame)) as Effect.Effect<any>)
    const text = (n: any): string => (n._tag === 'Text' ? n.text : n._tag === 'Reactive' ? text(n.child) : (n.children ?? []).map(text).join(''))
    let setters: Record<string, (next: any) => void> = {}
    const Local = ({ name }: { name: string }) =>
      Effect.map(useLocal(0), ([n, set]) => {
        setters[name] = set
        return el('i', {}, `${name}${n}`)
      })

    it('persists across re-runs; value and updater setters change it; siblings and keys are independent', async () => {
      setters = {}
      const P = () => jsx(Fragment, { children: [jsx(Local, { name: 'a' }), jsx(Local, { name: 'b' }), jsx(Local, { name: 'k' }, 'x'), jsx(Local, { name: 'l' }, 'y')] })
      const node: any = await run(jsx(P, {}, 'p'))
      const a = node.child.children[0]
      expect(a.atoms).toHaveLength(1)
      setters.a!(5)
      setters.k!((n: number) => n + 2)
      expect(text(await Effect.runPromise(a.rerun))).toBe('a5')
      setters.a!((n: number) => n + 1)
      expect(text(await Effect.runPromise(a.rerun))).toBe('a6')
      expect(text(await Effect.runPromise(node.rerun))).toBe('a6b0k2l0')
    })

    // Children of a fragment register in the frame they run in; each run of the parent gets a fresh frame over the same slots.
    const kidsOf = (more: boolean) => jsx(Fragment, { children: [jsx(Local, { name: 'a' }), more && jsx(Local, { name: 'b' }, 'b')] })

    it('dropping a run disposes only the slots it created', async () => {
      setters = {}
      const store = makeAtomStore()
      const f1 = makeFrame()
      await run(kidsOf(false), store, f1)
      commitSlots(f1)
      setters.a!(4)
      const f2 = makeFrame(f1.owner)
      await run(kidsOf(true), store, f2)
      const kids = f1.owner.kids!
      const b = [...kids].find(([id]) => id.endsWith(':key:b'))![1]
      expect(kids.size).toBe(2)
      dropSlots(f2)
      expect(kids.size).toBe(1)
      await new Promise((r) => setTimeout(r, 0))
      expect(store.inspect().map((e) => e.atom)).not.toContain(b.atoms[0])
      expect(text(await run(kidsOf(false), store, makeFrame(f1.owner)))).toBe('a4')
    })

    it('commit disposes slots of ids the committed run did not hold', async () => {
      const store = makeAtomStore()
      const f1 = makeFrame()
      await run(kidsOf(true), store, f1)
      commitSlots(f1)
      const f2 = makeFrame(f1.owner)
      await run(kidsOf(false), store, f2)
      commitSlots(f2)
      expect([...f1.owner.kids!.keys()]).toEqual([...f2.seen!])
    })

    it('a run with a different useLocal count fails with SlotMismatch and keeps the slot count', async () => {
      let extra = false
      const C = () => Effect.flatMap(useLocal(1), ([n]) => (extra ? Effect.map(useLocal(2), () => el('p', {}, String(n))) : Effect.succeed(el('p', {}, String(n)))))
      const node: any = await run(jsx(C, {}, 'c'))
      extra = true
      expect(await Effect.runPromise(Effect.flip(node.rerun as Effect.Effect<any, any>))).toBeInstanceOf(SlotMismatch)
      extra = false
      expect(text(await Effect.runPromise(node.rerun))).toBe('1')
      const D = ({ k }: { k: number }) => (k === 2 ? Effect.succeed(el('p')) : Effect.map(useLocal(0), () => el('p')))
      const frame = makeFrame()
      await run(jsx(D, { k: 1 }), undefined, frame)
      const err = await Effect.runPromise(Effect.flip(jsx(D, { k: 2 }).pipe(Effect.provideService(Store, makeAtomStore()), Effect.provideService(Frame, makeFrame(frame.owner))) as Effect.Effect<any, any>))
      expect(err).toMatchObject({ _tag: 'SlotMismatch', expected: 1, actual: 0 })
    })

    it('renderToString renders initial; outside an instance the setter is a no-op', async () => {
      expect(await renderToString(jsx(Local, { name: 'a' }), { layer: Layer.empty })).toBe('<i>a0</i>')
      const [n, set] = await Effect.runPromise(Effect.provideService(useLocal(7), Store, makeAtomStore()))
      expect(n).toBe(7)
      expect(set(1)).toBeUndefined()
    })
  })
})
