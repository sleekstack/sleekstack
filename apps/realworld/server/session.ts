import { Cookies, Request } from '@sleekstack/start'
import { Effect, Layer, Option } from 'effect'
import { type User, Viewer } from '../src/modules/identity'
import { ViewerLive } from './identity'

/** The session cookie: the token, out of reach of scripts. */
export const SESSION = 'conduit_session'
// The token's own lifetime (server/crypto.ts).
const SESSION_SECONDS = 30 * 24 * 60 * 60

/**
 * `effect` as the viewer whose token the session cookie holds: anonymous without one. A stale cookie (bad, expired, or
 * naming a deleted user) is cleared and reads as anonymous too, so a method that needs a viewer is `Unauthorized`.
 * The cookie is read per call.
 */
export const asViewer = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.flatMap(Cookies, (cookies) =>
    Effect.provide(
      effect,
      ViewerLive(cookies.get(SESSION)).pipe(
        Layer.catchAll(() =>
          Layer.effect(Viewer, Effect.as(Effect.orDie(cookies.delete(SESSION, { path: '/' })), Option.none())),
        ),
      ),
    ),
  )

/** Session cookies are `Secure` in production and on any https request; dev over http keeps working. */
export const secure = Effect.map(
  Request,
  (request) => process.env.NODE_ENV === 'production' || request.url.startsWith('https:'),
)

/** Signs `user` in on this browser: the session cookie holds their token. */
export const signIn = (user: User) =>
  Effect.flatMap(Effect.zip(Cookies, secure), ([cookies, secure]) =>
    cookies.set(SESSION, user.token, { httpOnly: true, secure, sameSite: 'Lax', path: '/', maxAge: SESSION_SECONDS }),
  ).pipe(Effect.orDie, Effect.as(user))
