// The projects module's public API: what other modules may import.
export type { Project } from './domain/model'
export { ProjectNotFound } from './domain/errors'
export { ProjectRepo } from './domain/ports'
export { projectAtom } from './application/state'
export { ProjectNav } from './presentation/nav'
