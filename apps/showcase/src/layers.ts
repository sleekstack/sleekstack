import { Layer } from 'effect'
import { UiQueryClientLive } from '@sleekstack/query/ui'
import ServerServicesLive from 'virtual:sleek/server'
import { IdentityLive } from './modules/identity/infrastructure'
import { ProjectsLive } from './modules/projects/infrastructure'
import { TasksLive } from './modules/tasks/infrastructure'

export { ViewerLive } from './modules/identity/infrastructure'

export const AppLive = Layer.mergeAll(IdentityLive, ProjectsLive, TasksLive)

/**
 * The browser's layer: `AppLive` plus the scope's QueryClient, built over it so `effectFn` queries see the repos, and
 * every Server Service as a client over the wire.
 */
export const AppWithQueriesLive = (config?: Parameters<typeof UiQueryClientLive>[0]) =>
  UiQueryClientLive(config).pipe(Layer.provideMerge(AppLive), Layer.merge(ServerServicesLive))
