import { favoritedArticles, profile } from '../../../pages/loaders'

export { FavoritesPage as default } from '../_profile'

export const loaders = [profile, favoritedArticles.first]
