import { Layer } from 'effect'
import { Clock } from '../services'

export default Layer.succeed(Clock, { now: () => 1 })
