import { Effect } from 'effect'
import { Viewer } from '../src/viewer'

/** The viewer is the `x-viewer` header, and a failed decode answers 422. */
export const wrap = (next: Effect.Effect<Response, unknown, Viewer>, request: Request): Effect.Effect<Response, unknown> =>
  next.pipe(
    Effect.provideService(Viewer, request.headers.get('x-viewer') ?? 'anonymous'),
    Effect.catchIf(
      (e) => (e as { readonly _tag?: string })._tag === 'ParseError',
      () => Effect.succeed(new Response(null, { status: 422 })),
    ),
  )
