import { UiQueryClientLive } from '@sleekstack/query/ui'
import { Layer } from 'effect'

/** The client composition root: the only importer of the modules' `infrastructure`. */
export const AppLive = Layer.empty

/**
 * The browser's `QueryClient`. The router builds it again for every page it shows, so a navigation (the one after a
 * login or logout included) starts with an empty cache; the viewer is in each list's key as well. A cached page is
 * shown again without a call for a minute. A failed read is shown at once, not retried.
 */
export const QueriesLive = UiQueryClientLive({ defaultOptions: { queries: { staleTime: 60_000, retry: false } } })
