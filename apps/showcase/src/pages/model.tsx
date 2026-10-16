/** @jsxImportSource @sleekstack/ui */
import { Atom, type DraftSpec, type ModelSpec } from '@sleekstack/core'
import { Effect, Schema } from 'effect'
import { useAction, useAtomValue, useDraft, useFormStatus, useSetAtom } from '@sleekstack/ui'
import { Viewer } from '../modules/identity'

// The wire: what the read endpoint returns (a country code), and what the write endpoint takes.
type ProfileDto = {
  readonly id: string
  readonly name: string
  readonly age: number
  readonly country: string
  readonly editedBy: string
}
type ProfilePatch = Pick<ProfileDto, 'name' | 'age' | 'editedBy'>

// The Model: what the view renders, the same fields with the country's name for its code. `ctx` is resolved data the
// DTO does not carry: country names by code.
type Profile = ProfileDto
const ProfileModel = {
  fromDto: (dto, countries) => ({ ...dto, country: countries[dto.country] ?? dto.country }),
} satisfies ModelSpec<ProfileDto, Profile, Readonly<Record<string, string>>>
const COUNTRIES = { gb: 'United Kingdom', us: 'United States' }

/** The record as the server holds it, one per store; writing a patch applies it, as the write endpoint would. */
const server: Atom.Writable<ProfileDto, Partial<ProfileDto>> = Atom.writable(
  (get) => get.self<ProfileDto>() ?? { id: 'p1', name: 'Ada Lovelace', age: 36, country: 'gb', editedBy: 'Ada' },
  (cx, patch) => cx.setSelf({ ...cx.get(server), ...patch }),
)
/** The Draft's source: the Model of the server's record. */
const profile = Atom.make((get) => ProfileModel.fromDto(get(server), COUNTRIES))

// The Draft holds what the inputs hold: `age` is a string, validated here and converted in `toDto`.
type ProfileForm = { readonly name: string; readonly age: string }
const wholeNumber = /^\d+$/
const ProfileFormSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.filter((s) => s.trim() !== '' || 'Enter a name')),
  age: Schema.String.pipe(Schema.pattern(wholeNumber, { message: () => 'Enter a whole number' })),
})

const ProfileDraft = {
  schema: () => ProfileFormSchema,
  create: (p) => ({ name: p.name, age: String(p.age) }),
  // An Effect: who saves comes from the `Viewer` Service, so the form action requires it and `sleekstack check` sees it.
  toDto: (d) => Effect.map(Viewer, ({ user }) => ({ name: d.name.trim(), age: Number(d.age), editedBy: user.name })),
  // Total over a half-filled Draft: an age that is not a number yet previews the saved one.
  toModel: (d, p) => ({ ...p, name: d.name, age: wholeNumber.test(d.age) ? Number(d.age) : p.age }),
} satisfies DraftSpec<ProfileForm, ProfilePatch, Profile, Profile, never, Viewer>

/**
 * An edit form on a Draft of `profile`. "Someone else saves it" changes the source: a pristine Draft re-seeds from it, an
 * edited one keeps its edits. Save yields `draft.toDto()` in a Form Action, so a `ParseError` stays in its `Result`.
 */
const ProfileEditor = function* () {
  const draft = yield* useDraft(ProfileDraft, profile)
  const saved = yield* useAtomValue(profile)
  const patchServer = yield* useSetAtom(server)
  const setName = yield* useSetAtom(draft.field('name'))
  const setAge = yield* useSetAtom(draft.field('age'))
  const [result, save] = yield* useAction(function* () {
    const patch = yield* draft.toDto()
    yield* Effect.sleep('300 millis') // the write endpoint's round trip
    patchServer(patch)
    // The Draft kept its edits when its source changed; the saved record is its new seed.
    draft.reset()
  })
  const { pending } = yield* useFormStatus(result)
  const outcome = yield* useAtomValue(result)
  const errors = yield* useAtomValue(draft.errors)
  const dirty = yield* useAtomValue(draft.dirty)
  const preview = yield* useAtomValue(draft.preview)
  return (
    <>
      <p className="record">
        On the server: {saved.name}, {saved.age}, {saved.country}. Saved by {saved.editedBy}
      </p>
      <button type="button" className="external" onClick={() => patchServer({ age: saved.age + 1, editedBy: 'Linus' })}>
        Someone else saves it
      </button>
      <form className="draft" action={save}>
        <fieldset disabled={pending}>
          <label>
            Name{' '}
            <input
              className="name"
              name="name"
              value={draft.field('name')}
              onInput={(e) => setName(e.currentTarget.value)}
            />
          </label>
          {errors.name && <p className="error name-error">{errors.name[0]}</p>}
          <label>
            Age{' '}
            <input
              className="age"
              name="age"
              value={draft.field('age')}
              onInput={(e) => setAge(e.currentTarget.value)}
            />
          </label>
          {errors.age && <p className="error age-error">{errors.age[0]}</p>}
          <p className="preview">
            Preview: {preview.name}, {preview.age}, {preview.country}
          </p>
          <button type="button" className="reset" disabled={!dirty} onClick={draft.reset}>
            Reset
          </button>
          <button type="submit" className="save" disabled={!dirty}>
            {pending ? 'Saving' : 'Save'}
          </button>
        </fieldset>
        {outcome._tag === 'Failure' && <p className="error not-saved">Not saved: fix the fields above</p>}
      </form>
    </>
  )
}

export const ModelDraftDemo = () => (
  <section className="demo model">
    <h2>Model and Draft</h2>
    <ProfileEditor />
  </section>
)
