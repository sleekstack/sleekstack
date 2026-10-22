import { Effect } from 'effect'
import { NotFound } from '../../../src/errors'

/** `/api/` itself has no route: the JSON 404, as for an unknown path (a splat never matches zero segments). */
export const GET = () => Effect.fail(new NotFound({ resource: 'body' }))
