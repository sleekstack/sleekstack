/** @jsxImportSource @sleekstack/ui */
import type { Atom } from '@sleekstack/core'
import { useDraft } from '@sleekstack/model'
import { useAction, useAtomValue, useFormStatus, useSetAtom } from '@sleekstack/ui'
import { type Profile, ProfileDraft, Profiles } from './profile'

export const EditProfile = function* ({ profile }: { profile: Profile | Atom.Atom<Profile> }) {
  // One Draft for this instance: seeded from `profile`, re-seeded while untouched when `profile` changes.
  const draft = yield* useDraft(ProfileDraft, profile)
  const setName = yield* useSetAtom(draft.field('name'))
  const setAge = yield* useSetAtom(draft.field('age'))
  const [result, action] = yield* useAction(function* () {
    // Validates, then runs `ProfileDraft.toDto`: a ParseError or a failure of `toDto` stays in `result`.
    yield* Profiles.save(yield* draft.toDto())
  })
  const { pending } = yield* useFormStatus(result)
  const errors = yield* useAtomValue(draft.errors)
  const dirty = yield* useAtomValue(draft.dirty)
  const preview = yield* useAtomValue(draft.preview)
  const changes = yield* useAtomValue(draft.changes)
  return (
    <form action={action}>
      <h2>
        {preview.name}, {preview.age}
      </h2>
      <input name="name" value={draft.field('name')} onInput={(e) => setName(e.currentTarget.value)} />
      {errors.name && <p role="alert">{errors.name[0]}</p>}
      <input name="age" value={draft.field('age')} onInput={(e) => setAge(e.currentTarget.value)} />
      {errors.age && <p role="alert">{errors.age[0]}</p>}
      <p>Changed: {Object.keys(changes).join(', ') || 'nothing'}</p>
      <button type="button" disabled={!dirty} onClick={draft.reset}>
        Reset
      </button>
      <button type="submit" disabled={pending || !dirty}>
        Save
      </button>
    </form>
  )
}
