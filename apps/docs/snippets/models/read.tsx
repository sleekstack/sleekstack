/** @jsxImportSource @sleekstack/ui */
import { Atom, Result } from '@sleekstack/core'
import { Effect } from 'effect'
import { useAtomValue, useDerivedAtom } from '@sleekstack/ui'
import { EditProfile } from './edit-profile'
import { ProfileModel, type ProfileDto } from './profile'

// Data that is already resolved: a derived atom binds `ctx` and recomputes when either atom changes.
const profileDto = Atom.make<ProfileDto>({ id: 'p1', name: 'Ada Lovelace', age: 36, country: 'gb' })
const countryNames = Atom.make<Readonly<Record<string, string>>>({ gb: 'United Kingdom' })
export const profile = Atom.make((get) => ProfileModel.fromDto(get(profileDto), { countries: get(countryNames) }))

// Data from two requests: the Model is built once both have landed, so the page never renders a half-built Model.
class Api extends Effect.Tag('Api')<
  Api,
  {
    profile(id: string): Effect.Effect<ProfileDto>
    countries(): Effect.Effect<Readonly<Record<string, string>>>
  }
>() {}
const profileId = Atom.make('p1')

export const ProfilePage = function* () {
  const model = yield* useDerivedAtom(function* (get) {
    const [dto, countries] = yield* Effect.all([Api.profile(get(profileId)), Api.countries()], {
      concurrency: 'unbounded',
    })
    return ProfileModel.fromDto(dto, { countries })
  })
  return Result.match(yield* useAtomValue(model), {
    onInitial: () => <p>Loading</p>,
    onSuccess: ({ value }) => <EditProfile profile={value} />,
    onFailure: () => <p role="alert">Could not load the profile</p>,
  })
}
