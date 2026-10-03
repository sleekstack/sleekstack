import { Context, Data, Effect, Layer } from 'effect'
import { Catch, el, fromReact, mount, Provide } from '@sleekstack/ui'

class UserNotFound extends Data.TaggedError('UserNotFound')<{ id: string }> {}
class UserRepo extends Context.Tag('UserRepo')<UserRepo, { get(id: string): Effect.Effect<{ name: string }, UserNotFound> }>() {}
class Clock extends Context.Tag('Clock')<Clock, { now(): number }>() {}

const RepoLive = Layer.succeed(UserRepo, { get: (id) => (id === '1' ? Effect.succeed({ name: 'Ada' }) : Effect.fail(new UserNotFound({ id }))) })
const ClockLive = Layer.succeed(Clock, { now: () => 0 })

const Avatar = fromReact(({ name }: { name: string }) => name)

const UserCard = ({ id }: { id: string }) =>
  Effect.gen(function* () {
    const { name } = yield* (yield* UserRepo).get(id)
    const avatar = yield* Avatar({ name })
    return el('div', { class: 'card' }, el('h2', {}, name), avatar)
  })

const Stamp = () => Effect.map(Clock, (c) => el('time', {}, String(c.now())))

const app = (ids: readonly string[], wide: boolean) =>
  Catch('UserNotFound', () => el('p', {}, 'Not found'), Effect.gen(function* () {
    const cards = yield* Effect.all(ids.map((id) => UserCard({ id })))
    const stamp = yield* (wide ? Provide(ClockLive, Stamp()) : Provide(ClockLive, Stamp()))
    return el('main', {}, ...cards, stamp)
  }))

export const run = (container: Element) => mount(app(['1', '2'], true), { layer: RepoLive, container })
