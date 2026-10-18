/** @jsxImportSource @sleekstack/ui */
import { router } from '@sleekstack/router'
import { LoginPage, RegisterPage } from './pages/auth'
import { HomePage, NotFoundPage, Placeholder, signedIn, viewer } from './pages/layout'
import { table } from './pages/routes'
import { SettingsPage } from './pages/settings'

export { ServerFunctionsClient } from './pages/functions'

// Every page declares `viewer` for its header; a page only the signed-in user may see declares `signedIn` as well.
const open = [viewer]
const guarded = [viewer, signedIn]

/** The pages: rendered by `start` on the server and run by `startRouter` in the browser. */
export const pages = router({
  table,
  pages: {
    home: { render: () => <HomePage />, loaders: open },
    feed: { render: () => <Placeholder title="Your Feed" />, loaders: guarded },
    tag: { render: () => <Placeholder title="Tag" />, loaders: open },
    login: { render: () => <LoginPage />, loaders: open },
    register: { render: () => <RegisterPage />, loaders: open },
    settings: { render: () => <SettingsPage />, loaders: guarded },
    newArticle: { render: () => <Placeholder title="New Article" />, loaders: guarded },
    editArticle: { render: () => <Placeholder title="Edit Article" />, loaders: guarded },
    article: { render: () => <Placeholder title="Article" />, loaders: open },
    profile: { render: () => <Placeholder title="Profile" />, loaders: open },
    favorites: { render: () => <Placeholder title="Favorited Articles" />, loaders: open },
  },
  notFound: () => <NotFoundPage />,
})
