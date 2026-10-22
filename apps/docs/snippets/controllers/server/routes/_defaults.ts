import type { BodyTooLarge, InvalidPathEncoding, MethodNotAllowed, UnsupportedMediaType } from '@sleekstack/start'
import { Effect, ParseResult } from 'effect'
import { type NoteNotFound, Viewer } from '../notes'

/** The routing failures this `wrap` leaves to their default answers: 404, 405 with `Allow`, 413 and 415. */
type Routing = InvalidPathEncoding | MethodNotAllowed | BodyTooLarge | UnsupportedMediaType

/** A body of a Controller below is at most 16 KiB, unless the Controller exports its own `bodyLimit`. */
export const bodyLimit = 16_384

/**
 * Every Controller below runs as the viewer named by `x-user`, answers a missing note as a JSON 404, and answers a
 * failed decode as a 422 that lists each issue by its path, such as `body.title`.
 */
export const wrap = (
  next: Effect.Effect<Response, NoteNotFound | ParseResult.ParseError | Routing, Viewer>,
  request: Request,
): Effect.Effect<Response, Routing> =>
  next.pipe(
    Effect.provideService(Viewer, { name: request.headers.get('x-user') ?? 'guest' }),
    Effect.catchTags({
      NoteNotFound: (e) => Effect.succeed(Response.json({ error: `no note ${e.id}` }, { status: 404 })),
      ParseError: (e) =>
        Effect.succeed(Response.json({ issues: ParseResult.ArrayFormatter.formatErrorSync(e) }, { status: 422 })),
    }),
  )
