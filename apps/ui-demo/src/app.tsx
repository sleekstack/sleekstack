import { Data, Effect, Layer } from 'effect'
import { Catch, el, fromReact } from '@sleekstack/ui'

export class UserNotFound extends Data.TaggedError('UserNotFound')<{ id: string }> {}
export class UserRepo extends Effect.Tag('UserRepo')<UserRepo, { get(id: string): Effect.Effect<{ name: string }, UserNotFound> }>() {}

export const UserRepoLive = Layer.succeed(UserRepo, {
  get: (id) => (id === '1' ? Effect.succeed({ name: 'Ada' }) : Effect.fail(new UserNotFound({ id }))),
})

const Avatar = fromReact(({ name }: { name: string }) => <span className="avatar">{name}</span>)

export const UserCard = ({ id }: { id: string }) =>
  Effect.gen(function* () {
    const { name } = yield* UserRepo.get(id)
    const avatar = yield* Avatar({ name })
    return el('div', { class: 'card' }, el('h2', {}, name), avatar)
  })

export const app = (id: string) => Catch('UserNotFound', () => el('p', {}, 'Not found'), UserCard({ id }))
