import type { Atom } from '@sleekstack/core'
import { Effect, type Option, Schema } from 'effect'
import { expectTypeOf } from 'vitest'
import { defineRecord, defineTransformation, field } from '../index'

const Money = defineTransformation('money', (options: { readonly currency: string }) => ({
  from: Schema.Number,
  to: Schema.Struct({ amount: Schema.String, currency: Schema.String }),
  hydrate: (cents) => Effect.succeed({ amount: String(cents / 100), currency: options.currency }),
  serialize: ({ amount }) => Effect.succeed(Number(amount) * 100),
  defaultValue: () => ({ amount: '0', currency: options.currency }),
}))
const Flag = defineTransformation('flag', () => ({
  from: Schema.Literal('y', 'n'),
  to: Schema.Boolean,
  hydrate: (w) => Effect.succeed(w === 'y'),
  serialize: (b) => Effect.succeed(b ? ('y' as const) : ('n' as const)),
  defaultValue: () => false,
}))

expectTypeOf(Money.name).toEqualTypeOf<'money'>()
expectTypeOf<Schema.Schema.Type<ReturnType<typeof Money.of>>>().toEqualTypeOf<{
  readonly amount: string
  readonly currency: string
}>()
expectTypeOf<Schema.Schema.Encoded<ReturnType<typeof Money.of>>>().toEqualTypeOf<number | undefined>()

// @ts-expect-error options are typed
field(Money, { currency: 1 })
// @ts-expect-error options are required when the factory takes them
field(Money)
field(Flag)

defineTransformation('bad', () => ({
  from: Schema.Number,
  to: Schema.String,
  // @ts-expect-error hydrate returns the app input type
  hydrate: (n) => Effect.succeed(n),
  serialize: (s) => Effect.succeed(Number(s)),
  defaultValue: () => '',
}))

const Order = defineRecord('order', { fields: { id: Schema.String, total: field(Money, { currency: 'EUR' }) } })
Order.push({ id: '1', total: 1250 })
Order.push({ id: '1', total: undefined })
// @ts-expect-error push takes the wire value
Order.push({ id: '1', total: { amount: '1', currency: 'EUR' } })
expectTypeOf(Order.atom('1')).toEqualTypeOf<Atom.Atom<Option.Option<Schema.Schema.Type<typeof Order.schema>>>>()
expectTypeOf<Schema.Schema.Type<typeof Order.schema>['total']>().toEqualTypeOf<{
  readonly amount: string
  readonly currency: string
}>()
