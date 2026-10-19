/** @jsxImportSource @sleekstack/ui */
import type { Atom } from '@sleekstack/core'
import { type DraftSpec, useDraft } from '@sleekstack/model'
import { Link } from '@sleekstack/router'
import { type Child, useAction, useAtomValue, useFormStatus, useSetAtom } from '@sleekstack/ui'
import { Effect } from 'effect'
import { LoginUser, loginContract, NewUser, registerContract } from '../modules/identity'
import { ErrorList, errorsOf, toHome } from './form'
import { ServerFunctions } from './functions'
import { Layout } from './layout'
import { authLoaders } from './loaders'
import { table } from './routes'

/** A text input bound to a Draft field. */
export const Field = function* ({
  value,
  placeholder,
  type = 'text',
}: {
  value: Atom.Writable<string>
  placeholder: string
  type?: 'text' | 'email' | 'password'
}) {
  const set = yield* useSetAtom(value)
  return (
    <fieldset class="form-group">
      <input
        class="form-control form-control-lg"
        type={type}
        placeholder={placeholder}
        value={value}
        onInput={(e) => set(e.currentTarget.value)}
      />
    </fieldset>
  )
}

const AuthPage = ({ title, other, children }: { title: string; other: Child; children?: Child }) => (
  <Layout>
    <div class="auth-page">
      <div class="container page">
        <div class="row">
          <div class="col-md-6 offset-md-3 col-xs-12">
            <h1 class="text-xs-center">{title}</h1>
            <p class="text-xs-center">{other}</p>
            {children}
          </div>
        </div>
      </div>
    </div>
  </Layout>
)

// The server validates: the Drafts hold what the inputs hold and are sent as they are.
const LoginDraft = {
  schema: () => LoginUser,
  create: () => ({ email: '', password: '' }),
  toDto: (d) => Effect.succeed(d),
} satisfies DraftSpec<LoginUser, LoginUser>

const RegisterDraft = {
  schema: () => NewUser,
  create: () => ({ username: '', email: '', password: '' }),
  toDto: (d) => Effect.succeed(d),
} satisfies DraftSpec<NewUser, NewUser>

const LoginForm = function* () {
  const call = yield* ServerFunctions
  const draft = yield* useDraft(LoginDraft, undefined)
  const [result, submit] = yield* useAction(() => Effect.flatMap(draft.toDto(), (dto) => call(loginContract)(dto)))
  const { pending } = yield* useFormStatus(result)
  const outcome = yield* useAtomValue(result)
  return (
    <>
      <ErrorList errors={errorsOf(outcome)} />
      <form action={toHome(result, submit)}>
        <Field value={draft.field('email')} placeholder="Email" type="email" />
        <Field value={draft.field('password')} placeholder="Password" type="password" />
        <button class="btn btn-lg btn-primary pull-xs-right" type="submit" disabled={pending}>
          Sign in
        </button>
      </form>
    </>
  )
}

const RegisterForm = function* () {
  const call = yield* ServerFunctions
  const draft = yield* useDraft(RegisterDraft, undefined)
  const [result, submit] = yield* useAction(() => Effect.flatMap(draft.toDto(), (dto) => call(registerContract)(dto)))
  const { pending } = yield* useFormStatus(result)
  const outcome = yield* useAtomValue(result)
  return (
    <>
      <ErrorList errors={errorsOf(outcome)} />
      <form action={toHome(result, submit)}>
        <Field value={draft.field('username')} placeholder="Username" />
        <Field value={draft.field('email')} placeholder="Email" type="email" />
        <Field value={draft.field('password')} placeholder="Password" type="password" />
        <button class="btn btn-lg btn-primary pull-xs-right" type="submit" disabled={pending}>
          Sign up
        </button>
      </form>
    </>
  )
}

export const LoginPage = () => (
  <AuthPage
    title="Sign in"
    other={
      <Link table={table} loaders={authLoaders} href="/register">
        Need an account?
      </Link>
    }
  >
    <LoginForm />
  </AuthPage>
)

export const RegisterPage = () => (
  <AuthPage
    title="Sign up"
    other={
      <Link table={table} loaders={authLoaders} href="/login">
        Have an account?
      </Link>
    }
  >
    <RegisterForm />
  </AuthPage>
)
