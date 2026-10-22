import { Cookies, implement } from '@sleekstack/start'
import { Effect } from 'effect'
import { NameTaken, Profiles } from './profiles'

/** `implement` builds the Layer: each method may use the request services (`Request`, `Cookies`, ...), read per call. */
export const ProfilesSessionLive = implement(Profiles, {
  rename: ({ name }) =>
    Effect.gen(function* () {
      const cookies = yield* Cookies
      if (cookies.get('profile') === name) return yield* new NameTaken({ name })
      // The contract does not declare `InvalidCookie`, so a value outside the cookie grammar is a defect.
      yield* Effect.orDie(cookies.set('profile', name, { path: '/', httpOnly: true }))
      return { name }
    }),
  count: () => Effect.map(Cookies, (cookies) => (cookies.get('profile') === undefined ? 0 : 1)),
})
