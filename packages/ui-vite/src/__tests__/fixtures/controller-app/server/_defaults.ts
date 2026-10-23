import { Effect } from 'effect'

/** A failed decode answers 422. */
export const wrap = (next: Effect.Effect<Response, unknown>): Effect.Effect<Response, unknown> =>
  Effect.catchIf(
    next,
    (e) => (e as { readonly _tag?: string })._tag === 'ParseError',
    () => Effect.succeed(new Response(null, { status: 422 })),
  )
