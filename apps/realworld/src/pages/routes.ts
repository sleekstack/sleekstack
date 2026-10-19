import { routes } from '@sleekstack/router'

/** Every page's path. Tab and tag are routes because loaders see only the pathname. */
export const table = routes({
  home: '/',
  feed: '/feed',
  tag: '/tag/:tag',
  login: '/login',
  register: '/register',
  settings: '/settings',
  newArticle: '/editor',
  editArticle: '/editor/:slug',
  article: '/article/:slug',
  profile: '/profile/:username',
  favorites: '/profile/:username/favorites',
})
