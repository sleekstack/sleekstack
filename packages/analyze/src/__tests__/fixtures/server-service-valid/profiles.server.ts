import { Effect, Layer } from 'effect'
import { Profiles } from './contract'

export const ProfilesLive = Layer.succeed(Profiles, {
  rename: (input) => Effect.succeed(input),
  list: () => Effect.succeed([]),
  get: () => Effect.succeed({ name: 'a' }),
})
