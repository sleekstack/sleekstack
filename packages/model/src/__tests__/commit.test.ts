import { type AtomStore, makeAtomStore } from '@sleekstack/core'
import { Store } from '@sleekstack/ui'
import { Cause, Data, Deferred, Effect, Exit, FiberId, Layer, Option, ParseResult, Schema } from 'effect'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  defineRecord,
  defineTransformation,
  field,
  type RecordAdapter,
  SaveInFlight,
  SaveResponseError,
} from '../index'
import { slotOf } from '../registry'

const serialized = { count: 0 }
// Wire: integer cents. The Draft holds a bounded decimal string, checked before `serialize` runs `Number()`.
const Money = defineTransformation('money', (_: { readonly currency: string }) => ({
  from: Schema.Number,
  to: Schema.String.pipe(Schema.pattern(/^\d{1,9}(\.\d{1,2})?$/)),
  hydrate: (cents: number) => Effect.succeed((cents / 100).toFixed(2)),
  serialize: (amount: string) => Effect.sync(() => (serialized.count++, Math.round(Number(amount) * 100))),
  defaultValue: () => '0.00',
}))

type OrderWire = {
  readonly id: string
  readonly note: string
  readonly due: string
  readonly total: number | undefined
}
class Rejected extends Data.TaggedError('Rejected')<{}> {}
class OrderApi extends Effect.Tag('OrderApi')<OrderApi, RecordAdapter<OrderWire, unknown, Rejected>>() {}

const Order = defineRecord('order', {
  fields: { id: Schema.String, note: Schema.String, due: Schema.Date, total: field(Money, { currency: 'EUR' }) },
  adapter: OrderApi,
})

/** An adapter whose `save` waits until the test answers it with `reply(i, exit)`. */
const gated = () => {
  const saves: Array<{ id: string; change: unknown; reply: Deferred.Deferred<OrderWire, Rejected> }> = []
  const layer = Layer.succeed(OrderApi, {
    find: () => Effect.die('unused'),
    save: (id, change) =>
      Effect.suspend(() => {
        const reply = Deferred.unsafeMake<OrderWire, Rejected>(FiberId.none)
        saves.push({ id, change, reply })
        return Deferred.await(reply)
      }),
  })
  const answer = (i: number, wire: OrderWire) => Effect.runSync(Deferred.succeed(saves[i]!.reply, wire))
  const reject = (i: number) => Effect.runSync(Deferred.fail(saves[i]!.reply, new Rejected()))
  return { saves, layer, answer, reject }
}

const run = <A, E>(s: AtomStore, layer: Layer.Layer<OrderApi>, e: Effect.Effect<A, E, Store | OrderApi>) =>
  Effect.runPromiseExit(e.pipe(Effect.provide(layer), Effect.provideService(Store, s)))
const tick = () => new Promise((r) => setTimeout(r, 0))
const wire = (note: string): OrderWire => ({ id: '1', note, due: '2026-01-02T00:00:00.000Z', total: 1250 })
const record = (note: string) => ({ id: '1', note, due: new Date('2026-01-02T00:00:00.000Z'), total: '12.50' })

/** A store holding order 1 with `note`, and its Draft, kept alive as a component's would be. */
const setup = (note = 'A') => {
  const s = makeAtomStore()
  Effect.runSync(Effect.provideService(Order.push(wire(note)), Store, s))
  const draft = Effect.runSync(Effect.provideService(Order.useDraft('1'), Store, s))
  s.retain(draft.value)
  s.retain(draft.dirty)
  const note$ = draft.field('note')
  return { s, draft, edit: (v: string) => s.set(note$, v), api: gated() }
}

describe('commit', () => {
  it('saves the Draft through the adapter and writes the acknowledged record into the map', async () => {
    const { s, draft, edit, api } = setup()
    edit('B')
    const saving = run(s, api.layer, Order.commit('1', draft))
    await tick()
    expect(api.saves.map((x) => [x.id, x.change])).toEqual([
      ['1', { note: 'B', due: '2026-01-02T00:00:00.000Z', total: 1250 }],
    ])
    expect(s.get(Order.atom('1'))).toEqual(Option.some(record('A')))
    api.answer(0, wire('B'))
    expect(await saving).toEqual(Exit.succeed(record('B')))
    expect(s.get(Order.atom('1'))).toEqual(Option.some(record('B')))
    expect(Option.isSome(s.get(slotOf(s, 'order', '1')).ackedAt)).toBe(true)
    expect(s.get(draft.dirty)).toBe(false)
    expectTypeOf<Effect.Effect.Error<ReturnType<typeof Order.commit>>>().toEqualTypeOf<
      Rejected | ParseResult.ParseError | SaveInFlight | SaveResponseError
    >()
  })

  it.each([
    ['the save fails', (api: ReturnType<typeof gated>) => api.reject(0), Rejected],
    [
      'its response does not hydrate',
      (api: ReturnType<typeof gated>) => api.answer(0, { ...wire('B'), due: 'not a date' }),
      SaveResponseError,
    ],
  ])('when %s, the map and the Draft are unchanged', async (_, settle, failure) => {
    const { s, draft, edit, api } = setup()
    edit('B')
    const saving = run(s, api.layer, Order.commit('1', draft))
    await tick()
    settle(api)
    const exit = await saving
    expect(Exit.isFailure(exit) && Cause.failureOption(exit.cause).pipe(Option.getOrThrow)).toBeInstanceOf(failure)
    expect(s.get(Order.atom('1'))).toEqual(Option.some(record('A')))
    expect(s.get(slotOf(s, 'order', '1')).ackedAt).toEqual(Option.none())
    expect(s.get(draft.field('note'))).toBe('B')
    expect(s.get(draft.dirty)).toBe(true)
  })

  it('an oversized or invalid Draft value fails with a ParseError before serialize or save runs', async () => {
    const { s, draft, api } = setup()
    s.set(draft.field('total'), '9'.repeat(400))
    serialized.count = 0
    const exit = await run(s, api.layer, Order.commit('1', draft))
    expect(
      Exit.isFailure(exit) && ParseResult.isParseError(Cause.failureOption(exit.cause).pipe(Option.getOrThrow)),
    ).toBe(true)
    expect(serialized.count).toBe(0)
    expect(api.saves).toEqual([])
  })

  it('a second commit of the record while one is saving fails with SaveInFlight', async () => {
    const { s, draft, edit, api } = setup()
    edit('B')
    const first = run(s, api.layer, Order.commit('1', draft))
    await tick()
    expect(await run(s, api.layer, Order.commit('1', draft))).toEqual(
      Exit.fail(new SaveInFlight({ type: 'order', id: '1' })),
    )
    expect(api.saves.length).toBe(1)
    api.answer(0, wire('B'))
    expect(Exit.isSuccess(await first)).toBe(true)
  })
})

describe('the derived Draft', () => {
  it('holds every field but id in its input form; a date holds its string; defaultValue seeds a missing record', () => {
    const { s, draft } = setup()
    expect(s.get(draft.value)).toEqual({ note: 'A', due: '2026-01-02T00:00:00.000Z', total: '12.50' })
    // The input types: a transformed field is its `to` input, not the wire's `number | undefined`.
    const input: { readonly note: string; readonly due: string; readonly total: string } = s.get(draft.value)
    void input
    s.set(draft.field('due'), 'not a date')
    expect(Object.keys(s.get(draft.errors))).toEqual(['due'])

    const blank = Effect.runSync(Effect.provideService(Order.useDraft('new'), Store, s))
    expect(s.get(blank.value)).toEqual({ note: undefined, due: undefined, total: '0.00' })
  })

  it('A, submit B, edit C, acknowledge B: the C edit is kept, B reads clean and A reads dirty', async () => {
    const { s, draft, edit, api } = setup('A')
    edit('B')
    const saving = run(s, api.layer, Order.commit('1', draft))
    await tick()
    edit('C')
    api.answer(0, wire('B'))
    await saving
    expect(s.get(draft.field('note'))).toBe('C')
    expect(s.get(draft.dirty)).toBe(true)
    edit('B')
    expect(s.get(draft.dirty)).toBe(false)
    edit('A')
    expect(s.get(draft.dirty)).toBe(true)
  })
})
