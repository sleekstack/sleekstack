import { Effect } from 'effect'
import { defineHandler } from '@sleekstack/ui'

const ok = defineHandler('ok', () => Effect.void)
const id = 'computed'
const computed = defineHandler(id, () => Effect.void)
let mutable = ok

export const clean = <button onClick={ok}>fine</button>
export const closure = <button onClick={() => Effect.void}>a closure is not a handler</button>
export const inline = <a onClick={defineHandler('x', () => Effect.void)}>x</a> // @error NonResumableHandler
export const viaLet = <a onClick={mutable}>x</a> // @error NonResumableHandler
export const literalId = <a onInput={computed}>x</a> // @error NonResumableHandler
export const action = <form action={ok}>fine</form>
export const actionViaLet = <form action={mutable}>x</form> // @error NonResumableHandler
