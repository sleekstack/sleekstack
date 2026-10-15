import { Layer } from 'effect'
import { UserRepoLive } from './repos'

export { ViewerLive } from './repos'

/** Everything the identity module's ports need. */
export const IdentityLive = Layer.mergeAll(UserRepoLive)
