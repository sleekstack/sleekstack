// The identity module's public API: what other modules may import.
export type { User } from './domain/model'
export { UserNotFound } from './domain/errors'
export { UserRepo, Viewer } from './domain/ports'
export { Avatar } from './presentation/avatar'
export { MaybeAssignee } from './presentation/assignee'
export { Header, Team } from './presentation/team'
