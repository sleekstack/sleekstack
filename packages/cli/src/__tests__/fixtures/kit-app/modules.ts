// A kit-only board graph: Infra -> Data (Store private) -> Activity -> App (thunk imports, request-lifetime layers).
import { layer, module, withCleanup } from '@sleekstack/kit'
import {
  ActivityLog,
  Clock,
  CommentRepo,
  IdGen,
  Logger,
  ProjectRepo,
  RequestContext,
  Store,
  TaskRepo,
  UnitOfWork,
} from './tags'

let seq = 0
const ClockLayer = layer(Clock, { now: () => Date.now() })
const LoggerLayer = layer(Logger, { log: (message: string) => console.log(message) })
const IdGenLayer = layer(IdGen, { next: (prefix: string) => `${prefix}_${++seq}` })
const StoreLayer = layer(Store, () => ({ tasks: new Map() }))
const ProjectRepoLayer = layer(ProjectRepo, (store) => ({ list: () => [...store.tasks.keys()] }), [Store])
const TaskRepoLayer = layer(
  TaskRepo,
  (store, _idGen, _clock) => ({
    listByProject: (projectId: string) => [...store.tasks.values()].filter((t) => t.projectId === projectId),
  }),
  [Store, IdGen, Clock],
)
const CommentRepoLayer = layer(CommentRepo, (store, _idGen, _clock) => ({ count: () => store.tasks.size }), [
  Store,
  IdGen,
  Clock,
])
const UnitOfWorkLayer = layer(UnitOfWork, (store) => withCleanup({ commit: () => store.tasks.clear() }, () => {}), [Store], {
  lifetime: 'request',
})
const ActivityLogLayer = layer(ActivityLog, (clock) => ({ record: (message: string) => void [message, clock.now()] }), [
  Clock,
])
const RequestContextLayer = layer(
  RequestContext,
  (idGen, activityLog) => {
    const requestId = idGen.next('req')
    activityLog.record(`request ${requestId} opened`)
    return withCleanup({ requestId }, () => activityLog.record(`request ${requestId} closed`))
  },
  [IdGen, ActivityLog],
  { lifetime: 'request' },
)

const InfraModule = module({
  name: 'Infra',
  provide: [ClockLayer, LoggerLayer, IdGenLayer],
  exports: [Clock, Logger, IdGen],
})

const DataModule = module({
  name: 'Data',
  imports: [InfraModule],
  provide: [StoreLayer, ProjectRepoLayer, TaskRepoLayer, CommentRepoLayer, UnitOfWorkLayer],
  exports: [ProjectRepo, TaskRepo, CommentRepo, UnitOfWork],
})

const ActivityModule = module({
  name: 'Activity',
  imports: [InfraModule],
  provide: [ActivityLogLayer],
  exports: [ActivityLog],
})

export const AppModule = module({
  name: 'App',
  imports: () => [DataModule, ActivityModule],
  provide: [RequestContextLayer],
  exports: [ProjectRepo, TaskRepo, CommentRepo, ActivityLog, Clock, Logger, IdGen, RequestContext, UnitOfWork],
})
