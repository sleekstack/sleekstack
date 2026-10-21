import { pages } from 'virtual:sleekstack/routes'
import { articleLoaders, authLoaders, profileLoaders } from '../pages/loaders'

/**
 * Loads route `name`'s page code, for a `Link`'s `code` prefetch beside its loaders: a client page is its own chunk,
 * loaded on first use; on the server every page is already loaded. Read when called, never while the routes load.
 */
export const code = (name: keyof typeof pages) => () => pages[name].load?.() ?? Promise.resolve()

/** The targets an article preview (and its signed-out favorite button) links to; with the route table, its `links`. */
export const previewTargets = {
  article: { loaders: articleLoaders, code: code('article/[slug]') },
  profile: { loaders: profileLoaders, code: code('profile/[username]/index') },
  login: { loaders: authLoaders, code: code('login') },
}
