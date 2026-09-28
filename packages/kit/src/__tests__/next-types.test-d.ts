import { expectTypeOf } from 'vitest'
import { tag } from '../index'
import { action, query, type ActionResult } from '../next'

interface User { id: string }
abstract class Users { abstract find(id: string): Promise<User | undefined> }
interface Clock { now(): number }
const Clock = tag<Clock>('Clock')

export const getUser = action((users, clock) => async (id: string) => { clock.now(); return users.find(id) }, [Users, Clock])
expectTypeOf(getUser).toEqualTypeOf<(id: string) => Promise<ActionResult<User | undefined>>>()

const now = query((clock) => () => clock.now(), [Clock])
expectTypeOf(now).toEqualTypeOf<() => Promise<number>>()

// @ts-expect-error deps are typed: Clock has no `find`
action((clock) => () => clock.find(), [Clock])
