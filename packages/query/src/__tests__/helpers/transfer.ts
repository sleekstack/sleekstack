import type { QueryClient } from '@tanstack/query-core'
import { Layer } from 'effect'
import { QueryClientTag } from '../../client'
import { QueryTransferLive } from '../../ui'

/** A layer providing `client` and the `Transfer` that carries it through a server render. */
export const withTransfer = (client: QueryClient) => {
  const base = Layer.succeed(QueryClientTag, client)
  return Layer.merge(base, QueryTransferLive.pipe(Layer.provide(base)))
}
