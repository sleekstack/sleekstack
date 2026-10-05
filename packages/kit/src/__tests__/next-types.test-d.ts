import { expectTypeOf } from 'vitest'
import { Effect } from 'effect'
import { tag } from '../index'
import { defineEffect, defineQuery, type ActionResult } from '../next'

interface User {
  id: string
}
interface Users {
  find(id: string): Promise<User | undefined>
}
const Users = tag<Users>('Users')
interface Clock {
  now(): number
}
const Clock = tag<Clock>('Clock')

const id = '1'
const getUserEffect = defineEffect(function* (id: string) {
  const users = yield* Users
  const clock = yield* Clock
  clock.now()
  return yield* Effect.promise(() => users.find(id))
})
const getUser = getUserEffect(id)
expectTypeOf(getUser).toEqualTypeOf<Promise<ActionResult<User | undefined>>>()

const nowQuery = defineQuery(function* () {
  return (yield* Clock).now()
})
const now = nowQuery()
expectTypeOf(now).toEqualTypeOf<Promise<number>>()

defineEffect(function* () {
  // @ts-expect-error yield* of a Tag returns its typed service: Clock has no `find`
  return (yield* Clock).find()
})
