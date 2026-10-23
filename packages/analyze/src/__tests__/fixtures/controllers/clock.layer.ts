import { Layer } from 'effect'
import { Clock } from './services'

/** Provides `Clock` to every Controller and wrap. */
export default Layer.succeed(Clock, { now: () => 0 })
