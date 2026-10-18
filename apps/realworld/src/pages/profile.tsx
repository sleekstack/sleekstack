/** @jsxImportSource @sleekstack/ui */
import { Result } from '@sleekstack/core'
import { loader, notFound, Route, useLoader } from '@sleekstack/router'
import { useAction, useAtomValue, useDerivedAtom, useFormStatus } from '@sleekstack/ui'
import { Effect, Option } from 'effect'
import { listArticlesContract } from '../modules/articles'
import { followContract, Profile, profileContract, unfollowContract } from '../modules/identity'
import { ServerFunctions } from './functions'
import { ArticleFeed, type ArticleSource, articleSource } from './home'
import { Layout, viewer } from './layout'

const profileHref = (username: string) => `/profile/${encodeURIComponent(username)}`

// Both profile routes name the user `:username`.
const username = Effect.map(Route, (m) => m.params['username']!)

/** The profile the route names; an unknown user is the 404 page. */
export const profile = loader(
  'profile',
  Profile,
  Effect.flatMap(Effect.zip(ServerFunctions, username), ([call, name]) =>
    call(profileContract)({ username: name }),
  ).pipe(Effect.catchTag('NotFound', notFound)),
)

export const authoredArticles = articleSource('authoredArticles', (paging) =>
  Effect.flatMap(Effect.zip(ServerFunctions, username), ([call, author]) =>
    call(listArticlesContract)({ ...paging, author }),
  ),
)
export const favoritedArticles = articleSource('favoritedArticles', (paging) =>
  Effect.flatMap(Effect.zip(ServerFunctions, username), ([call, favorited]) =>
    call(listArticlesContract)({ ...paging, favorited }),
  ),
)

/** Follow or unfollow `user`; the button shows the server's answer. A signed-out viewer gets a link to `/login`. */
const Follow = function* ({ user, signedIn }: { user: Profile; signedIn: boolean }) {
  const call = yield* ServerFunctions
  const [result, run] = yield* useAction((): Effect.Effect<Profile, unknown> =>
    call(current.following ? unfollowContract : followContract)({ username: current.username }),
  )
  const confirmed = yield* useDerivedAtom((get) => Option.getOrElse(Result.value(get(result)), () => user))
  const current = yield* useAtomValue(confirmed)
  const { pending } = yield* useFormStatus(result)
  const style = `btn btn-sm action-btn ${current.following ? 'btn-secondary' : 'btn-outline-secondary'}`
  const label = (
    <>
      <i class="ion-plus-round"></i> {current.following ? 'Unfollow' : 'Follow'} {current.username}
    </>
  )
  if (!signedIn)
    return (
      <a class={style} href="/login">
        {label}
      </a>
    )
  return (
    <form class="follow" action={run}>
      <button class={style} type="submit" disabled={pending}>
        {label}
      </button>
    </form>
  )
}

/** Follow or unfollow `user`, or a link to `/login` for a signed-out viewer. */
export const FollowButton = (props: { user: Profile; signedIn: boolean }) => <Follow {...props} />

const ProfileView = function* ({ favorites }: { favorites: boolean }) {
  const shown = yield* Effect.either(useLoader(profile))
  const me = yield* Effect.orElseSucceed(useLoader(viewer), () => null)
  if (shown._tag === 'Left') return <div class="container page">The profile could not be loaded: try again.</div>
  const user = shown.right
  const source: ArticleSource = favorites ? favoritedArticles : authoredArticles
  return (
    <div class="profile-page">
      <div class="user-info">
        <div class="container">
          <div class="row">
            <div class="col-xs-12 col-md-10 offset-md-1">
              {user.image && <img src={user.image} class="user-img" alt="" />}
              <h4>{user.username}</h4>
              {user.bio && <p>{user.bio}</p>}
              {me?.username === user.username ? (
                <a class="btn btn-sm btn-outline-secondary action-btn" href="/settings">
                  <i class="ion-gear-a"></i> Edit Profile Settings
                </a>
              ) : (
                <FollowButton user={user} signedIn={me !== null} />
              )}
            </div>
          </div>
        </div>
      </div>
      <div class="container">
        <div class="row">
          <div class="col-xs-12 col-md-10 offset-md-1">
            <div class="articles-toggle">
              <ul class="nav nav-pills outline-active">
                <li class="nav-item">
                  <a class={favorites ? 'nav-link' : 'nav-link active'} href={profileHref(user.username)}>
                    My Articles
                  </a>
                </li>
                <li class="nav-item">
                  <a
                    class={favorites ? 'nav-link active' : 'nav-link'}
                    href={`${profileHref(user.username)}/favorites`}
                  >
                    Favorited Articles
                  </a>
                </li>
              </ul>
            </div>
            <ArticleFeed source={source} />
          </div>
        </div>
      </div>
    </div>
  )
}

export const ProfilePage = () => (
  <Layout>
    <ProfileView favorites={false} />
  </Layout>
)

export const FavoritesPage = () => (
  <Layout>
    <ProfileView favorites />
  </Layout>
)
