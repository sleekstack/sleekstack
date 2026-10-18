import { Context, Effect, Stream } from 'effect'
import { Atom } from '@sleekstack/core'

class Clock extends Context.Tag('Clock')<Clock, { now(): number }>() {}
class Repo extends Context.Tag('Repo')<Repo, { get(id: string): string }>() {}
const Logger = Context.GenericTag<{ log(m: string): void }>('Logger')

export const count = Atom.make(Effect.map(Clock, (c) => c.now()))
export const doubled = Atom.make((get) => Effect.map(Clock, (c) => c.now() * get(plain)))
export const plain = Atom.make(2)
export const derived = Atom.make((get) => get(plain) + 1)
export const todo = Atom.family((id: string) => Atom.make(Effect.flatMap(Repo, (r) => Effect.succeed(r.get(id)))))
export const feed = Atom.make(Stream.fromEffect(Effect.zip(Logger, Clock)))
declare const loose: Effect.Effect<number, never, any>
export const untyped = Atom.make(loose) // @error Unresolvable
export const clock = Atom.make(Clock)
export const logger = Atom.make(() => Logger)
