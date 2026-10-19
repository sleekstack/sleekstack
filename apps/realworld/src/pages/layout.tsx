/** @jsxImportSource @sleekstack/ui */
import { Link, type LinkProps, type Loaders, loader, redirect, Route, useLoader } from '@sleekstack/router'
import type { Child } from '@sleekstack/ui'
import { Effect, Schema } from 'effect'
import { Account, currentUserContract } from '../modules/identity'
import { ServerFunctions } from './functions'
import { table } from './routes'

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

/** A target route's loaders (as `app.tsx` declares them) for a page-body `Link`, so hover and focus prefetch them. */
export type RouteLoaders = LinkProps<ServerFunctions | Route | Loaders>['loaders']

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

const Footer = () => (
  <footer>
    <div class="container">
      <Link table={table} href="/" class="logo-font">
        conduit
      </Link>
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
        <Link table={table} class="navbar-brand" href="/">
          conduit
        </Link>
      </div>
    </nav>
    <div class="container page">
      <h1>Page not found</h1>
      <Link table={table} href="/">
        Back to the home page
      </Link>
    </div>
    <Footer />
  </>
)
