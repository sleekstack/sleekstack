import { Cookies, implement, Request } from '@sleekstack/start'
import { Effect, Layer, Option } from 'effect'
import { IdentityApi, type User, Viewer } from '../src/modules/identity'
import { Db } from './db'
import {
  currentUser,
  follow,
  login,
  profile,
  register,
  TokenSecret,
  unfollow,
  updateUser,
  ViewerLive,
} from './identity'

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
const secure = Effect.map(
  Request,
  (request) => process.env.NODE_ENV === 'production' || request.url.startsWith('https:'),
)

/** Signs `user` in on this browser: the session cookie holds their token. */
const signIn = (user: User) =>
  Effect.flatMap(Effect.zip(Cookies, secure), ([cookies, secure]) =>
    cookies.set(SESSION, user.token, { httpOnly: true, secure, sameSite: 'Lax', path: '/', maxAge: SESSION_SECONDS }),
  ).pipe(Effect.orDie, Effect.as(user))

/** `IdentityApi` over the server's `Db` and `TokenSecret`, taken once when the Layer is built. */
export const IdentityApiLive = Layer.unwrapEffect(
  Effect.map(Effect.context<Db | TokenSecret>(), (server) => {
    const asViewerOnServer = <A, E>(effect: Effect.Effect<A, E, Db | TokenSecret | Viewer>) =>
      Effect.provide(asViewer(effect), server)
    return implement(IdentityApi, {
      register: (input) => Effect.provide(Effect.flatMap(register(input), signIn), server),
      login: (input) => Effect.provide(Effect.flatMap(login(input), signIn), server),
      logout: () => Effect.flatMap(Cookies, (cookies) => Effect.orDie(cookies.delete(SESSION, { path: '/' }))),
      current: () => asViewerOnServer(currentUser),
      update: (input) => asViewerOnServer(updateUser(input)),
      profile: ({ username }) => asViewerOnServer(profile(username)),
      follow: ({ username }) => asViewerOnServer(follow(username)),
      unfollow: ({ username }) => asViewerOnServer(unfollow(username)),
    })
  }),
)
