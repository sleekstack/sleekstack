import { Context, Data, Effect, Layer } from 'effect'
import { createElement } from 'react'
import { Catch, el, fromReact } from '../../index'

export class UserNotFound extends Data.TaggedError('UserNotFound')<{ readonly id: string }> {}

export class UserRepo extends Context.Tag('UserRepo')<
  UserRepo,
  { readonly get: (id: string) => Effect.Effect<{ name: string }, UserNotFound> }
>() {}

export const UserRepoTest = Layer.succeed(UserRepo, {
  get: (id) => (id === '1' ? Effect.succeed({ name: 'Ada' }) : Effect.fail(new UserNotFound({ id }))),
})

export const Avatar = fromReact(({ name }: { name: string }) => createElement('span', { className: 'avatar' }, name))

export const UserCard = ({ id }: { id: string }) =>
  Effect.gen(function* () {
    const { name } = yield* (yield* UserRepo).get(id)
    const avatar = yield* Avatar({ name })
    return el('div', { class: 'card' }, el('h2', {}, name), avatar)
  })

export const app = (id: string) => Catch('UserNotFound', () => el('p', {}, 'Not found'), UserCard({ id }))
