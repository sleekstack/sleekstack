import { Effect, Layer } from 'effect'
import { ProjectNotFound } from '../domain/errors'
import { ProjectRepo } from '../domain/ports'
import { projects } from './seed'

const find = <A extends { id: string }, E>(
  xs: ReadonlyArray<A>,
  id: string,
  fail: (id: string) => E,
): Effect.Effect<A, E> => {
  const hit = xs.find((x) => x.id === id)
  return hit ? Effect.succeed(hit) : Effect.fail(fail(id))
}

export const ProjectRepoLive = Layer.succeed(ProjectRepo, {
  all: () => Effect.succeed(projects),
  get: (id) => find(projects, id, (id) => new ProjectNotFound({ id })),
})
