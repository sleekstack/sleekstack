import { Effect } from 'effect'
import { Clock } from '../../services'

/** Its result requires `Clock`, which a Layer File provides. */
export const wrap = (next: Effect.Effect<Response>, _request: Request): Effect.Effect<Response, never, Clock> =>
  Effect.zipRight(Clock, next)
