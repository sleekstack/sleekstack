/** @jsxImportSource @sleekstack/ui */
import { Atom, Result } from '@sleekstack/core'
import {
  type DraftSpec,
  defineRecord,
  type ModelSpec,
  type RecordAdapter,
  ref,
  useDraft,
  useRecord,
} from '@sleekstack/model'
import { Cause, Effect, Layer, Option, Schema } from 'effect'
import { Provider, useAction, useAtomValue, useFormStatus, useSetAtom } from '@sleekstack/ui'
import { Viewer } from '../modules/identity'
import { User } from '../modules/users'

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
// An age as typed: up to three digits and at most 150, so `Number` of it is always a safe integer.
const isAge = (s: string) => /^\d{1,3}$/.test(s) && Number(s) <= 150
const ProfileFormSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.filter((s) => s.trim() !== '' || 'Enter a name')),
  age: Schema.String.pipe(Schema.filter((s) => isAge(s) || 'Enter an age from 0 to 150')),
})

const ProfileDraft = {
  schema: () => ProfileFormSchema,
  create: (p) => ({ name: p.name, age: String(p.age) }),
  // An Effect: who saves comes from the `Viewer` Service, so the form action requires it and `sleekstack check` sees it.
  toDto: (d) => Effect.map(Viewer, ({ user }) => ({ name: d.name.trim(), age: Number(d.age), editedBy: user.name })),
  // Total over a half-filled Draft: an age that is not a number yet previews the saved one.
  toModel: (d, p) => ({ ...p, name: d.name, age: isAge(d.age) ? Number(d.age) : p.age }),
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

// Records: one shared value per type and id in the Store. `User` is served (`server/routes/api/users/[id].controller.ts`),
// so its adapter is the generated browser Layer; `Post` loads through a hand-written adapter Service in the same Store.
type PostWire = { readonly id: string; readonly title: string; readonly author: string | null }
class PostApi extends Effect.Tag('PostApi')<PostApi, RecordAdapter<PostWire>>() {}

const Post = defineRecord('post', {
  fields: { id: Schema.String, title: Schema.String, author: ref(() => User) },
  adapter: PostApi,
})

/** A fake server for the posts: an in-memory table per mount. */
const PostApiLive = Layer.sync(PostApi, () => {
  const posts = new Map<string, PostWire>([['post1', { id: 'post1', title: 'Notes on the Engine', author: 'u1' }]])
  return {
    find: (id) => Effect.fromNullable(posts.get(id)).pipe(Effect.orDieWith(() => `no post ${id}`)),
    save: () => Effect.dieMessage('posts are read-only here'),
  }
})

/** The post and its author through `related`: it follows the user in the map and never fetches. */
const PostCard = function* () {
  const post = yield* useRecord(Post, 'post1')
  const author = yield* useAtomValue(Post.related('post1', 'author'))
  const name = Option.flatMap(author, (a) => (a === null ? Option.none() : a.value))
  if (Result.isInitial(post)) return <p className="post">Loading</p>
  if (Result.isFailure(post)) return <p className="error">Could not load the post</p>
  return (
    <p className="post">
      {post.value.title}, by {Option.match(name, { onNone: () => 'unknown', onSome: (u) => u.name })}
    </p>
  )
}

/**
 * The user's derived Draft: `commit` saves it through the served Controller and writes the acknowledged user into the
 * map. The server's `RecordNotFound` or `RecordRejected` arrives typed.
 */
const UserEditor = function* () {
  const draft = yield* User.useDraft('u1')
  const setName = yield* useSetAtom(draft.field('name'))
  const [result, save] = yield* useAction(function* () {
    yield* User.commit('u1', draft)
  })
  const { pending } = yield* useFormStatus(result)
  const outcome = yield* useAtomValue(result)
  const error = outcome._tag === 'Failure' ? Option.getOrUndefined(Cause.failureOption(outcome.cause)) : undefined
  const errors = yield* useAtomValue(draft.errors)
  const dirty = yield* useAtomValue(draft.dirty)
  return (
    <form className="user-draft" action={save}>
      <label>
        Author{' '}
        <input
          className="user-name"
          name="name"
          value={draft.field('name')}
          onInput={(e) => setName(e.currentTarget.value)}
        />
      </label>
      {errors.name && <p className="error user-error">{errors.name[0]}</p>}
      <button type="submit" className="user-save" disabled={pending || !dirty}>
        {pending ? 'Saving' : 'Save'}
      </button>
      {error?._tag === 'RecordNotFound' && <p className="error user-not-saved">Not saved: the user is gone</p>}
      {error?._tag === 'RecordRejected' && <p className="error user-not-saved">Not saved: {error.message}</p>}
    </form>
  )
}

/** The user, loaded through the served Controller on first read; the editor shows once it is in the map. */
const UserCard = function* () {
  const user = yield* useRecord(User, 'u1')
  if (Result.isInitial(user)) return <p className="user">Loading</p>
  if (Result.isFailure(user)) return <p className="error">Could not load the user</p>
  return (
    <>
      <p className="user">User: {user.value.name}</p>
      <UserEditor />
    </>
  )
}

export const ModelDraftDemo = () => (
  <section className="demo model">
    <h2>Model and Draft</h2>
    <ProfileEditor />
    <h3>Records</h3>
    <Provider layer={PostApiLive}>
      <PostCard />
      <UserCard />
    </Provider>
  </section>
)
