import { Context, Effect, Layer } from 'effect'
import { el, mount, Provide } from '@sleekstack/ui'

class Repo extends Context.Tag('Repo')<Repo, string>() {}
class Clock extends Context.Tag('Clock')<Clock, number>() {}
class Db extends Context.Tag('Db')<Db, string>() {}

const RepoLive = Layer.succeed(Repo, 'r')
const ClockFromDb = Layer.effect(Clock, Effect.as(Db, 1))

const Child = () => Effect.map(Clock, (n) => el('i', {}, String(n)))
const Parent = () =>
  Effect.gen(function* () {
    const child = yield* Child() // @error MissingDependency
    const repo = yield* Repo
    return el('div', {}, repo, child)
  })
const Timed = () => Effect.map(Clock, (n) => el('b', {}, String(n)))

export const a = (c: Element) => mount(Parent(), { layer: RepoLive, container: c })
export const b = (c: Element) => mount(Provide(ClockFromDb, Timed()), { layer: RepoLive, container: c }) // @error MissingDependency
export const root = (c: Element) => mount(Effect.map(Clock, (n) => el('b', {}, String(n))), { layer: RepoLive, container: c }) // @error MissingDependency
