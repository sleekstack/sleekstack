/** @jsxImportSource @sleekstack/ui */
import { Result } from '@sleekstack/core'
import { Link, useLoader } from '@sleekstack/router'
import { useAction, useAtomValue, useDerivedAtom, useFormStatus } from '@sleekstack/ui'
import { Effect, Option } from 'effect'
import { table } from 'virtual:sleekstack/routes'
import { followContract, type Profile, unfollowContract } from '../../modules/identity'
import { ServerFunctions } from '../../pages/functions'
import {
  type ArticleSource,
  authLoaders,
  authoredArticles,
  favoritedArticles,
  favoritesLoaders,
  profile,
  profileLoaders,
  signedIn,
  viewer,
} from '../../pages/loaders'
import { ArticleFeed } from '../_home'

const profileHref = (username: string) => `/profile/${encodeURIComponent(username)}`

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
      <Link table={table} loaders={authLoaders} class={style} href="/login">
        {label}
      </Link>
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
                <Link
                  table={table}
                  loaders={[viewer, signedIn]}
                  class="btn btn-sm btn-outline-secondary action-btn"
                  href="/settings"
                >
                  <i class="ion-gear-a"></i> Edit Profile Settings
                </Link>
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
                  <Link
                    table={table}
                    loaders={profileLoaders}
                    class={favorites ? 'nav-link' : 'nav-link active'}
                    href={profileHref(user.username)}
                  >
                    My Articles
                  </Link>
                </li>
                <li class="nav-item">
                  <Link
                    table={table}
                    loaders={favoritesLoaders}
                    class={favorites ? 'nav-link active' : 'nav-link'}
                    href={`${profileHref(user.username)}/favorites`}
                  >
                    Favorited Articles
                  </Link>
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

export const ProfilePage = () => <ProfileView favorites={false} />

export const FavoritesPage = () => <ProfileView favorites />
