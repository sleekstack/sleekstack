/** @jsxImportSource @sleekstack/ui */
import type { Atom } from '@sleekstack/core'
import { Effect } from 'effect'
import { useAction, useAtomValue, useDraft, useOptimistic, useSetAtom } from '@sleekstack/ui'
import { type Profile, ProfileDraft, type ProfileForm, Profiles } from './profile'

export const QuickRename = function* ({ profile }: { profile: Atom.Atom<Profile> }) {
  const draft = yield* useDraft(ProfileDraft, profile)
  const setName = yield* useSetAtom(draft.field('name'))
  // `toModel` is the `apply`: while the save runs, `shown` is the saved Profile with the Draft applied.
  const [shown, optimistic] = yield* useOptimistic(profile, (p, d: ProfileForm) => ProfileDraft.toModel(d, p))
  const edited = yield* useAtomValue(draft.value)
  const [, action] = yield* useAction(function* () {
    yield* optimistic(edited, Effect.flatMap(draft.toDto(), Profiles.save))
  })
  const { name } = yield* useAtomValue(shown)
  return (
    <form action={action}>
      <h2>{name}</h2>
      <input name="name" value={draft.field('name')} onInput={(e) => setName(e.currentTarget.value)} />
      <button type="submit">Rename</button>
    </form>
  )
}
