import { Layer } from 'effect'
import { UiQueryClientLive } from '@sleekstack/query/ui'
import { UserRepoLive } from './modules/identity/infrastructure'
import { ProjectRepoLive } from './modules/projects/infrastructure'
import { TaskRepoLive } from './modules/tasks/infrastructure'

export { ViewerLive } from './modules/identity/infrastructure'

export const AppLive = Layer.mergeAll(UserRepoLive, ProjectRepoLive, TaskRepoLive)

/** `AppLive` plus the scope's QueryClient, built over it so `effectFn` queries see the repos. */
export const AppWithQueriesLive = (config?: Parameters<typeof UiQueryClientLive>[0]) =>
  UiQueryClientLive(config).pipe(Layer.provideMerge(AppLive))
