/** @jsxImportSource @sleekstack/ui */
import type { Atom, DraftSpec, ModelSpec } from '@sleekstack/core'
import { Context, Effect, Schema } from 'effect'
import { useAction, useAtomValue, useDraft, useFormStatus, useSetAtom } from '@sleekstack/ui'

// The wire: what the read endpoint returns, and what the write endpoint takes.
type ProfileDto = { readonly id: string; readonly name: string; readonly age: number; readonly country: string }
type ProfilePatch = { readonly id: string; readonly requestId: string; readonly name: string; readonly age: number }

class Ids extends Context.Tag('Ids')<Ids, { readonly next: () => string }>() {}
class Profiles extends Effect.Tag('Profiles')<Profiles, { save(patch: ProfilePatch): Effect.Effect<void> }>() {}

// The Model: what the view renders. `ctx` is resolved data the DTO does not carry.
type Profile = { readonly id: string; readonly name: string; readonly age: number; readonly country: string }
export const ProfileModel = {
  fromDto: (dto, { countries }) => ({ ...dto, country: countries[dto.country] ?? dto.country }),
} satisfies ModelSpec<ProfileDto, Profile, { readonly countries: Readonly<Record<string, string>> }>

// The Draft holds what the inputs hold: `age` is a string, validated here and converted in `toDto`.
type ProfileForm = { readonly name: string; readonly age: string }
const ProfileFormSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.filter((s) => s.trim() !== '' || 'Enter a name')),
  age: Schema.String.pipe(Schema.pattern(/^\d+$/, { message: () => 'Enter a whole number' })),
})

export const ProfileDraft = {
  schema: () => ProfileFormSchema,
  create: (p) => ({ name: p.name, age: String(p.age) }),
  // An Effect: the request id comes from a Service, so `Ids` is in the form action's requirements.
  toDto: (d, p) =>
    Effect.map(Ids, (ids) => ({ id: p.id, requestId: ids.next(), name: d.name.trim(), age: Number(d.age) })),
  toModel: (d, p) => ({ ...p, name: d.name, age: Number(d.age) || p.age }),
} satisfies DraftSpec<ProfileForm, ProfilePatch, Profile, Profile, never, Ids>

export const EditProfile = function* ({ profile }: { profile: Atom.Atom<Profile> }) {
  // One Draft for this instance: seeded from `profile`, re-seeded while untouched when `profile` changes.
  const draft = yield* useDraft(ProfileDraft, profile)
  const setName = yield* useSetAtom(draft.field('name'))
  const setAge = yield* useSetAtom(draft.field('age'))
  const [result, action] = yield* useAction(function* () {
    // A ParseError or a failure of `toDto` stays in `result`.
    yield* Profiles.save(yield* draft.toDto())
  })
  const { pending } = yield* useFormStatus(result)
  const errors = yield* useAtomValue(draft.errors)
  const dirty = yield* useAtomValue(draft.dirty)
  const preview = yield* useAtomValue(draft.preview)
  return (
    <form action={action}>
      <h2>
        {preview.name}, {preview.age}
      </h2>
      <input name="name" value={draft.field('name')} onInput={(e) => setName(e.currentTarget.value)} />
      {errors.name && <p role="alert">{errors.name[0]}</p>}
      <input name="age" value={draft.field('age')} onInput={(e) => setAge(e.currentTarget.value)} />
      {errors.age && <p role="alert">{errors.age[0]}</p>}
      <button type="button" disabled={!dirty} onClick={draft.reset}>
        Reset
      </button>
      <button type="submit" disabled={pending || !dirty}>
        Save
      </button>
    </form>
  )
}
