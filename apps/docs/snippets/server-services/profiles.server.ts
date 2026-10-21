import { Effect, Layer, Ref } from 'effect'
import { NameTaken, Profiles } from './profiles'

/** The implementation: an ordinary Layer, in a `*.server.ts` file the browser build refuses to load. */
export const ProfilesLive = Layer.effect(
  Profiles,
  Effect.map(Ref.make<ReadonlyArray<string>>([]), (names) => ({
    rename: ({ name }: { readonly name: string }) =>
      Effect.flatMap(Ref.get(names), (taken) =>
        taken.includes(name)
          ? Effect.fail(new NameTaken({ name }))
          : Effect.as(
              Ref.update(names, (list) => [...list, name]),
              { name },
            ),
      ),
    count: () => Effect.map(Ref.get(names), (list) => list.length),
  })),
)
