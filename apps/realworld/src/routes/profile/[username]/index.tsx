import { authoredArticles, profile } from '../../../pages/loaders'

export { ProfilePage as default } from '../_profile'

export const loaders = [profile, authoredArticles.first]
