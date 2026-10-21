import { feedArticles, popularTags } from '../_home'

export { FeedPage as default } from '../_home'

export const loaders = [popularTags, feedArticles.first]
