import { Effect } from 'effect'
import { Viewer } from '../src/notes'

/** The REST face's: a fixed viewer, and any failure answers 418. */
export const wrap = (next: Effect.Effect<Response, unknown, Viewer>): Effect.Effect<Response> =>
  next.pipe(
    Effect.provideService(Viewer, 'rest'),
    Effect.catchAll(() => Effect.succeed(new Response(null, { status: 418 }))),
  )
