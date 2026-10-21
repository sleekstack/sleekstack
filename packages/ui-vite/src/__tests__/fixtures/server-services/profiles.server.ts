import { Effect, Layer } from 'effect'
import { Profiles } from './contract'

export const ProfilesLive = Layer.succeed(Profiles, {
  rename: ({ name }) => Effect.succeed({ name, tags: [] }),
  count: () => Effect.succeed(0),
})
