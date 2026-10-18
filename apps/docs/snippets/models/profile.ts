import type { DraftSpec, ModelSpec } from '@sleekstack/core'
import { Context, Effect, Schema } from 'effect'

// The wire: what the read endpoint returns, and what the write endpoint takes. They are different shapes.
export type ProfileDto = { readonly id: string; readonly name: string; readonly age: number; readonly country: string }
export type ProfilePatch = {
  readonly id: string
  readonly requestId: string
  readonly name: string
  readonly age: number
}

export class Ids extends Context.Tag('Ids')<Ids, { readonly next: () => string }>() {}
export class Profiles extends Effect.Tag('Profiles')<Profiles, { save(patch: ProfilePatch): Effect.Effect<void> }>() {}

// The Model: what a component renders. `ctx` is resolved data the DTO does not carry: country names by code.
export type Profile = { readonly id: string; readonly name: string; readonly age: number; readonly country: string }
export const ProfileModel = {
  fromDto: (dto, { countries }) => ({ ...dto, country: countries[dto.country] ?? dto.country }),
} satisfies ModelSpec<ProfileDto, Profile, { readonly countries: Readonly<Record<string, string>> }>

// The Draft holds what the inputs hold: `age` is a string, validated here and converted in `toDto`.
export type ProfileForm = { readonly name: string; readonly age: string }
// Bounded on purpose: an unbounded digit string would pass validation and become `Infinity` in `Number(...)`.
const wholeNumber = /^\d{1,3}$/
const ProfileFormSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.filter((s) => s.trim() !== '' || 'Enter a name')),
  age: Schema.String.pipe(Schema.pattern(wholeNumber, { message: () => 'Enter an age from 0 to 999' })),
})

export const ProfileDraft = {
  schema: () => ProfileFormSchema,
  // The seed: the Model's values, as the inputs show them.
  create: (p) => ({ name: p.name, age: String(p.age) }),
  // An Effect: the request id comes from a Service, so `Ids` is in the form action's requirements.
  toDto: (d, p) =>
    Effect.map(Ids, (ids) => ({ id: p.id, requestId: ids.next(), name: d.name.trim(), age: Number(d.age) })),
  // Total over a half-filled Draft: an age that is not a number yet previews the saved one.
  toModel: (d, p) => ({ ...p, name: d.name, age: wholeNumber.test(d.age) ? Number(d.age) : p.age }),
  // The fields that changed since the seed, converted as `toDto` would; an age that is not a number yet is left out.
  diff: (base, next) => ({
    ...(base.name !== next.name && { name: next.name.trim() }),
    ...(base.age !== next.age && wholeNumber.test(next.age) && { age: Number(next.age) }),
  }),
} satisfies DraftSpec<ProfileForm, ProfilePatch, Profile, Profile, never, Ids>
