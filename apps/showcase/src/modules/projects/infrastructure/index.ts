import { Layer } from 'effect'
import { ProjectRepoLive } from './repos'

/** Everything the projects module's ports need. */
export const ProjectsLive = Layer.mergeAll(ProjectRepoLive)
