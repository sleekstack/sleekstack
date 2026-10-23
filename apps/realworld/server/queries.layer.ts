import { QueryClientLive } from '@sleekstack/query'

/**
 * The server's `QueryClient`: a page's lists take their first page from its loader (`initialData`) and never fetch here.
 * It carries no `Transfer`, so its cache never rides a response, and an entry is dropped right after it is read.
 */
// ponytail: one client for the process (start has no per-request layer). A list's key holds its path, page and viewer,
// so a concurrent render of the same key gets that viewer's data from moments earlier. Per-request client once start has one.
export default QueryClientLive({ defaultOptions: { queries: { gcTime: 0 } } })
