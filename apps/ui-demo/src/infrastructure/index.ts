import { Effect, Layer } from 'effect'
import { UiQueryClientLive } from '@sleekstack/query/ui'
import { UserRepo, Viewer } from '../domain/ports'
import { TaskRepoLive, UserRepoLive } from './repos'

export const AppLive = Layer.mergeAll(UserRepoLive, TaskRepoLive)

/** `AppLive` plus the scope's QueryClient, built over it so `effectFn` queries see the repos. */
export const AppWithQueriesLive = (config?: Parameters<typeof UiQueryClientLive>[0]) =>
  UiQueryClientLive(config).pipe(Layer.provideMerge(AppLive))

export const ViewerLive = (userId: string) =>
  Layer.effect(
    Viewer,
    UserRepo.get(userId).pipe(
      Effect.map((user) => ({ user })),
      Effect.orDie,
    ),
  ).pipe(Layer.provide(UserRepoLive))
