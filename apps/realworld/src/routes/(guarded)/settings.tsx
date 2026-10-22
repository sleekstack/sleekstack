/** @jsxImportSource @sleekstack/ui */
import { type DraftSpec, useDraft } from '@sleekstack/model'
import { useLoader } from '@sleekstack/router'
import { useAction, useAtomValue, useFormStatus, useSetAtom } from '@sleekstack/ui'
import { Effect, Schema } from 'effect'
import { type Account, IdentityApi, type UpdateUser } from '../../modules/identity'
import { Field } from '../../pages/field'
import { ErrorList, errorsOf, toHome } from '../../pages/form'
import { signedIn } from '../../pages/loaders'

const SettingsForm = Schema.Struct({
  image: Schema.String,
  username: Schema.String,
  bio: Schema.String,
  email: Schema.String,
  password: Schema.String,
})
type SettingsForm = typeof SettingsForm.Type

// A blank image or bio is cleared; a blank password leaves the password as it is.
const SettingsDraft = {
  schema: () => SettingsForm,
  create: (user) => ({
    image: user.image ?? '',
    username: user.username,
    bio: user.bio ?? '',
    email: user.email,
    password: '',
  }),
  toDto: (d) => Effect.succeed({ ...d, image: d.image.trim() || null, bio: d.bio.trim() ? d.bio : null }),
} satisfies DraftSpec<SettingsForm, UpdateUser, Account>

const Settings = function* ({ user }: { user: Account }) {
  const api = yield* IdentityApi
  const draft = yield* useDraft(SettingsDraft, user)
  const setBio = yield* useSetAtom(draft.field('bio'))
  const [saved, save] = yield* useAction(() => Effect.flatMap(draft.toDto(), api.update))
  const saving = (yield* useFormStatus(saved)).pending
  const [loggedOut, logout] = yield* useAction(() => api.logout())
  const loggingOut = (yield* useFormStatus(loggedOut)).pending
  const errors = [...errorsOf(yield* useAtomValue(saved)), ...errorsOf(yield* useAtomValue(loggedOut))]
  return (
    <div class="settings-page">
      <div class="container page">
        <div class="row">
          <div class="col-md-6 offset-md-3 col-xs-12">
            <h1 class="text-xs-center">Your Settings</h1>
            <ErrorList errors={errors} />
            <form action={toHome(saved, save)}>
              <fieldset disabled={saving}>
                <Field value={draft.field('image')} placeholder="URL of profile picture" />
                <Field value={draft.field('username')} placeholder="Your Name" />
                <fieldset class="form-group">
                  <textarea
                    class="form-control form-control-lg"
                    rows={8}
                    placeholder="Short bio about you"
                    value={draft.field('bio')}
                    onInput={(e) => setBio(e.currentTarget.value)}
                  />
                </fieldset>
                <Field value={draft.field('email')} placeholder="Email" type="email" />
                <Field value={draft.field('password')} placeholder="New Password" type="password" />
                <button class="btn btn-lg btn-primary pull-xs-right" type="submit">
                  Update Settings
                </button>
              </fieldset>
            </form>
            <hr />
            <form action={toHome(loggedOut, logout)}>
              <button class="btn btn-outline-danger" type="submit" disabled={loggingOut}>
                Or click here to logout.
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

const SignedInSettings = function* () {
  return yield* Effect.match(useLoader(signedIn), {
    onFailure: () => <ErrorList errors={['Your settings could not be loaded: try again']} />,
    onSuccess: (user) => <Settings user={user} />,
  })
}

export default SignedInSettings
