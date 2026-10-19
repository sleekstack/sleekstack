/** @jsxImportSource @sleekstack/ui */
import { type DraftSpec, useDraft } from '@sleekstack/model'
import { useLoader } from '@sleekstack/router'
import { useAction, useAtomValue, useFormStatus, useSetAtom } from '@sleekstack/ui'
import { Effect, Either, Schema } from 'effect'
import { type Account, logoutContract, type UpdateUser, updateUserContract } from '../modules/identity'
import { Field } from './auth'
import { ErrorList, errorsOf, toHome } from './form'
import { ServerFunctions } from './functions'
import { Layout, viewer } from './layout'

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
  const call = yield* ServerFunctions
  const draft = yield* useDraft(SettingsDraft, user)
  const setBio = yield* useSetAtom(draft.field('bio'))
  const [saved, save] = yield* useAction(() => Effect.flatMap(draft.toDto(), (dto) => call(updateUserContract)(dto)))
  const saving = (yield* useFormStatus(saved)).pending
  const [loggedOut, logout] = yield* useAction(() => call(logoutContract)())
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

// The route's `signedIn` loader keeps anonymous visitors out. The page reads `viewer`, not `signedIn`: after logout this
// page re-runs while the router leaves it, and a `signedIn` read then would redirect that navigation to `/login`.
const SignedInSettings = function* () {
  const user = yield* Effect.either(useLoader(viewer))
  if (Either.isLeft(user)) return <ErrorList errors={['Your settings could not be loaded: try again']} />
  return user.right ? <Settings user={user.right} /> : <></>
}

export const SettingsPage = () => (
  <Layout>
    <SignedInSettings />
  </Layout>
)
