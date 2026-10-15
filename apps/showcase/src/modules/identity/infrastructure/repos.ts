import { Effect, Layer } from 'effect'
import { UserNotFound } from '../domain/errors'
import { UserRepo, Viewer } from '../domain/ports'
import { users } from './seed'

const find = <A extends { id: string }, E>(
  xs: ReadonlyArray<A>,
  id: string,
  fail: (id: string) => E,
): Effect.Effect<A, E> => {
  const hit = xs.find((x) => x.id === id)
  return hit ? Effect.succeed(hit) : Effect.fail(fail(id))
}

export const UserRepoLive = Layer.succeed(UserRepo, {
  all: () => Effect.succeed(users),
  get: (id) => find(users, id, (id) => new UserNotFound({ id })),
})

/** The user looking at the board; a viewer who is not a user is a defect. */
export const ViewerLive = (userId: string) =>
  Layer.effect(
    Viewer,
    UserRepo.get(userId).pipe(
      Effect.map((user) => ({ user })),
      Effect.orDie,
    ),
  ).pipe(Layer.provide(UserRepoLive))
