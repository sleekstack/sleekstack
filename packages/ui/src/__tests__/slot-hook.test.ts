import { Atom, makeAtomStore, MissingDependency } from '@sleekstack/core'
import { Context, Effect, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { el, SlotMismatch, useAtomValue } from '../index'
import { Collector, Frame, missingStore, Store, takeSlot, writeOwn } from '../internal'
import { jsx as rawJsx } from '../jsx-runtime'
import { isOwnWrite, makeFrame } from '../reactive'

const jsx = (type: any, props: any, key?: string) => rawJsx(type, props, key)

// A slot hook as a package outside ui writes one, through `ui/internal` only: a box that is the same object on every run.
const useBox = (): Effect.Effect<{ readonly id: number }, never, Store> =>
  Effect.flatMap(Effect.context<never>(), (ctx) => {
    const so = Context.getOption(ctx, Store)
    if (Option.isNone(so)) return missingStore('useBox')
    const f = Context.get(ctx, Frame)
    if (Context.get(ctx, Collector) === undefined || f === undefined) return Effect.succeed({ id: -1 })
    const taken = takeSlot(f)
    if (taken instanceof SlotMismatch) return Effect.fail(taken) as unknown as Effect.Effect<never>
    if (taken.first) f.owner.atoms.push(Atom.make({ id: Math.random() }) as unknown as Atom.Writable<any>)
    return Effect.succeed(so.value.get(f.owner.atoms[taken.i] as Atom.Atom<{ readonly id: number }>))
  })

const count = Atom.make(0)

describe('an external slot hook through ui/internal', () => {
  it('keeps its slot across runs and fails with SlotMismatch when the slot count changes', async () => {
    const boxes: Array<{ readonly id: number }> = []
    let extra = false
    const C = () =>
      Effect.gen(function* () {
        yield* useAtomValue(count)
        boxes.push(yield* useBox())
        if (extra) yield* useBox()
        return el('p')
      })
    const node: any = await Effect.runPromise(
      jsx(C, {}, 'c').pipe(
        Effect.provideService(Store, makeAtomStore()),
        Effect.provideService(Frame, makeFrame()),
      ) as Effect.Effect<any>,
    )
    await Effect.runPromise(node.rerun)
    expect(boxes).toHaveLength(2)
    expect(boxes[1]).toBe(boxes[0])
    extra = true
    expect(await Effect.runPromise(Effect.flip(node.rerun as Effect.Effect<any, any>))).toMatchObject({
      _tag: 'SlotMismatch',
      expected: 1,
      actual: 2,
    })
  })

  it('outside a component returns a slot-free value, and fails with MissingDependency without a Store', () => {
    expect(Effect.runSync(Effect.provideService(useBox(), Store, makeAtomStore()))).toEqual({ id: -1 })
    const err = Effect.runSync(Effect.flip(useBox() as unknown as Effect.Effect<unknown, unknown>))
    expect(err).toBeInstanceOf(MissingDependency)
    expect(err).toMatchObject({ tag: 'Store', service: 'useBox' })
  })

  it('writeOwn marks the writer for its write, nested writes included', () => {
    const [outer, inner] = [makeFrame().owner, makeFrame().owner]
    const seen: Array<boolean> = []
    writeOwn(outer, () => {
      writeOwn(inner, () => seen.push(isOwnWrite(inner), isOwnWrite(outer)))
      seen.push(isOwnWrite(outer))
    })
    expect([...seen, isOwnWrite(outer)]).toEqual([true, false, true, false])
  })
})
