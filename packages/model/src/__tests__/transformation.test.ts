import { type AtomStore, makeAtomStore } from '@sleekstack/core'
import { Store } from '@sleekstack/ui'
import { Effect, Either, Option, ParseResult, Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import { defineRecord, defineTransformation, field } from '../index'

// Wire: integer minor units. App: `{ amount, currency }`; the input a Draft holds is a bounded decimal string.
const Money = defineTransformation('money', (options: { readonly currency: string }) => ({
  from: Schema.Number,
  to: Schema.Struct({ amount: Schema.String.pipe(Schema.pattern(/^\d{1,9}(\.\d{1,2})?$/)), currency: Schema.String }),
  hydrate: (cents: number, ast) =>
    Number.isSafeInteger(cents)
      ? Effect.succeed({ amount: (cents / 100).toFixed(2), currency: options.currency })
      : Effect.fail(new ParseResult.Type(ast, cents, 'cents must be a safe integer')),
  serialize: ({ amount }: { readonly amount: string }) => Effect.succeed(Math.round(Number(amount) * 100)),
  defaultValue: () => ({ amount: '0.00', currency: options.currency }),
}))

const Order = defineRecord('order', { fields: { id: Schema.String, total: field(Money, { currency: 'EUR' }) } })
const Invoice = defineRecord('invoice', { fields: { id: Schema.String, due: field(Money, { currency: 'USD' }) } })

const run = <A, E>(s: AtomStore, e: Effect.Effect<A, E, Store>) =>
  Effect.runPromise(Effect.either(Effect.provideService(e, Store, s)))
const isParseError = (e: Either.Either<unknown, unknown>) => Either.isLeft(e) && ParseResult.isParseError(e.left)

describe('defineTransformation', () => {
  it('hydrates on push: the record holds the app value', async () => {
    const s = makeAtomStore()
    await run(s, Order.push({ id: '1', total: 1250 }))
    expect(s.get(Order.atom('1'))).toEqual(Option.some({ id: '1', total: { amount: '12.50', currency: 'EUR' } }))
  })

  it('a hydrate failure is a typed ParseError and writes nothing', async () => {
    const s = makeAtomStore()
    expect(isParseError(await run(s, Order.push({ id: '1', total: 0.5 })))).toBe(true)
    expect(s.get(Order.atom('1'))).toEqual(Option.none())
  })

  it('serializes the app value to the wire value', () => {
    expect(Schema.encodeSync(field(Money, { currency: 'EUR' }))({ amount: '3.20', currency: 'EUR' })).toBe(320)
  })

  it('an oversized numeric input fails serialize with a typed ParseError, before Number()', () => {
    const out = Schema.encodeEither(field(Money, { currency: 'EUR' }))({ amount: '9'.repeat(400), currency: 'EUR' })
    expect(Either.isLeft(out) && ParseResult.isParseError(out.left)).toBe(true)
  })

  it('defaultValue supplies the value of a field with no value', async () => {
    const s = makeAtomStore()
    await run(s, Order.push({ id: '1', total: undefined }))
    expect(s.get(Order.atom('1'))).toEqual(Option.some({ id: '1', total: { amount: '0.00', currency: 'EUR' } }))
  })

  it('one transformation serves two records with their own options', async () => {
    const s = makeAtomStore()
    await run(s, Order.push({ id: '1', total: 100 }))
    await run(s, Invoice.push({ id: '1', due: 200 }))
    expect(s.get(Order.atom('1'))).toEqual(Option.some({ id: '1', total: { amount: '1.00', currency: 'EUR' } }))
    expect(s.get(Invoice.atom('1'))).toEqual(Option.some({ id: '1', due: { amount: '2.00', currency: 'USD' } }))
  })

  it('structurally equal options give the same field Schema; other options another', () => {
    expect(field(Money, { currency: 'EUR' })).toBe(field(Money, { currency: 'EUR' }))
    expect(field(Money, { currency: 'USD' })).not.toBe(field(Money, { currency: 'EUR' }))
  })
})
