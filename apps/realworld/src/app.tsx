/** @jsxImportSource @sleekstack/ui */
import { router } from '@sleekstack/router'
import { article, ArticlePage, comments } from './pages/article'
import { LoginPage, RegisterPage } from './pages/auth'
import { editable, EditArticlePage, NewArticlePage } from './pages/editor'
import { feedArticles, FeedPage, globalArticles, HomePage, popularTags, tagArticles, TagPage } from './pages/home'
import { NotFoundPage, signedIn, viewer } from './pages/layout'
import { authoredArticles, FavoritesPage, favoritedArticles, profile, ProfilePage } from './pages/profile'
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
    home: { render: () => <HomePage />, loaders: [...open, popularTags, globalArticles.first] },
    feed: { render: () => <FeedPage />, loaders: [...guarded, popularTags, feedArticles.first] },
    tag: { render: () => <TagPage />, loaders: [...open, popularTags, tagArticles.first] },
    login: { render: () => <LoginPage />, loaders: open },
    register: { render: () => <RegisterPage />, loaders: open },
    settings: { render: () => <SettingsPage />, loaders: guarded },
    newArticle: { render: () => <NewArticlePage />, loaders: guarded },
    editArticle: { render: () => <EditArticlePage />, loaders: [...guarded, article, editable] },
    article: { render: () => <ArticlePage />, loaders: [...open, article, comments] },
    profile: { render: () => <ProfilePage />, loaders: [...open, profile, authoredArticles.first] },
    favorites: { render: () => <FavoritesPage />, loaders: [...open, profile, favoritedArticles.first] },
  },
  notFound: () => <NotFoundPage />,
})
