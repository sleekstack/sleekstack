/** @jsxImportSource @sleekstack/ui */
import { loader, redirect, useLoader } from '@sleekstack/router'
import type { Child } from '@sleekstack/ui'
import { Effect, Schema } from 'effect'
import { Account, currentUserContract } from '../modules/identity'
import { ServerFunctions } from './functions'

/**
 * Who is signed in, or `null`: every page declares it, so the server resolves it from the session cookie and sends it
 * with the page, and the hydrating browser renders the same header. A bad session reads as signed out.
 */
export const viewer = loader(
  'viewer',
  Schema.NullOr(Account),
  Effect.flatMap(ServerFunctions, (call) => call(currentUserContract)()).pipe(
    Effect.catchTag('Unauthorized', () => Effect.succeed(null)),
  ),
)

/** The signed-in user, for a page only they may see: anyone else is sent to `/login`. */
export const signedIn = loader(
  'signedIn',
  Account,
  Effect.flatMap(useLoader(viewer), (user) => (user ? Effect.succeed(user) : redirect('/login'))),
)

const profileHref = (username: string) => `/profile/${encodeURIComponent(username)}`

const Header = function* () {
  // A viewer the browser could not load (the network failed) shows the signed-out links; the next navigation reloads it.
  const user = yield* Effect.orElseSucceed(useLoader(viewer), () => null)
  return (
    <nav class="navbar navbar-light">
      <div class="container">
        <a class="navbar-brand" href="/">
          conduit
        </a>
        <ul class="nav navbar-nav pull-xs-right">
          <li class="nav-item">
            <a class="nav-link" href="/">
              Home
            </a>
          </li>
          {user ? (
            <>
              <li class="nav-item">
                <a class="nav-link" href="/editor">
                  <i class="ion-compose"></i> New Article
                </a>
              </li>
              <li class="nav-item">
                <a class="nav-link" href="/settings">
                  <i class="ion-gear-a"></i> Settings
                </a>
              </li>
              <li class="nav-item">
                <a class="nav-link" href={profileHref(user.username)}>
                  {user.image && <img class="user-pic" src={user.image} alt="" />}
                  {user.username}
                </a>
              </li>
            </>
          ) : (
            <>
              <li class="nav-item">
                <a class="nav-link" href="/login">
                  Sign in
                </a>
              </li>
              <li class="nav-item">
                <a class="nav-link" href="/register">
                  Sign up
                </a>
              </li>
            </>
          )}
        </ul>
      </div>
    </nav>
  )
}

const Footer = () => (
  <footer>
    <div class="container">
      <a href="/" class="logo-font">
        conduit
      </a>
      <span class="attribution">
        An interactive learning project from <a href="https://thinkster.io">Thinkster</a>. Code &amp; design licensed
        under MIT.
      </span>
    </div>
  </footer>
)

/** A routed page inside the header (which reads `viewer`, so the page must declare it) and the footer. */
export const Layout = ({ children }: { children?: Child }) => (
  <>
    <Header />
    {children}
    <Footer />
  </>
)

/** The page for a path no route matches. Its header has no viewer-dependent links: no route, so no loaders. */
export const NotFoundPage = () => (
  <>
    <nav class="navbar navbar-light">
      <div class="container">
        <a class="navbar-brand" href="/">
          conduit
        </a>
      </div>
    </nav>
    <div class="container page">
      <h1>Page not found</h1>
      <a href="/">Back to the home page</a>
    </div>
    <Footer />
  </>
)

/** Stands in for a page a later change builds. */
export const Placeholder = ({ title }: { title: string }) => (
  <Layout>
    <div class="container page">
      <h1>{title}</h1>
    </div>
  </Layout>
)

export const HomePage = () => (
  <Layout>
    <div class="home-page">
      <div class="banner">
        <div class="container">
          <h1 class="logo-font">conduit</h1>
          <p>A place to share your knowledge.</p>
        </div>
      </div>
    </div>
  </Layout>
)
