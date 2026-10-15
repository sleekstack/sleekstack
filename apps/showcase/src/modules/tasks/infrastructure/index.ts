import { Layer } from 'effect'
import { TaskRepoLive } from './repos'

/** Everything the tasks module's ports need. */
export const TasksLive = Layer.mergeAll(TaskRepoLive)
