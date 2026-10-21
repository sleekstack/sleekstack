/** @jsxImportSource @sleekstack/ui */
import { Link, useLoader } from '@sleekstack/router'
import type { Child } from '@sleekstack/ui'
import { Effect } from 'effect'
import { table } from 'virtual:sleekstack/routes'
import { viewer } from '../pages/loaders'
import { Footer } from './_footer'

const profileHref = (username: string) => `/profile/${encodeURIComponent(username)}`

const Header = function* () {
  // A viewer the browser could not load (the network failed) shows the signed-out links; the next navigation reloads it.
  const user = yield* Effect.orElseSucceed(useLoader(viewer), () => null)
  // Home is the viewer's default tab: Your Feed when signed in, else the Global Feed.
  const home = user ? '/feed' : '/'
  return (
    <nav class="navbar navbar-light">
      <div class="container">
        <Link table={table} class="navbar-brand" href={home}>
          conduit
        </Link>
        <ul class="nav navbar-nav pull-xs-right">
          <li class="nav-item">
            <Link table={table} class="nav-link" href={home}>
              Home
            </Link>
          </li>
          {user ? (
            <>
              <li class="nav-item">
                <Link table={table} class="nav-link" href="/editor">
                  <i class="ion-compose"></i> New Article
                </Link>
              </li>
              <li class="nav-item">
                <Link table={table} class="nav-link" href="/settings">
                  <i class="ion-gear-a"></i> Settings
                </Link>
              </li>
              <li class="nav-item">
                <Link table={table} class="nav-link" href={profileHref(user.username)}>
                  {user.image && <img class="user-pic" src={user.image} alt="" />}
                  {user.username}
                </Link>
              </li>
            </>
          ) : (
            <>
              <li class="nav-item">
                <Link table={table} class="nav-link" href="/login">
                  Sign in
                </Link>
              </li>
              <li class="nav-item">
                <Link table={table} class="nav-link" href="/register">
                  Sign up
                </Link>
              </li>
            </>
          )}
        </ul>
      </div>
    </nav>
  )
}

/** Every page inside the header (which reads `viewer`, so this layout declares it) and the footer. */
export default function Layout({ children }: { children?: Child }) {
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  )
}

export const loaders = [viewer]
