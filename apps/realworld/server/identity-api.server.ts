import { Cookies, implement } from '@sleekstack/start'
import { Effect, Layer } from 'effect'
import { IdentityApi, type Viewer } from '../src/modules/identity'
import type { Db } from './db'
import { currentUser, follow, login, profile, register, type TokenSecret, unfollow, updateUser } from './identity'
import { asViewer, SESSION, signIn } from './session'

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
