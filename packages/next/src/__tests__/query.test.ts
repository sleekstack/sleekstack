import { describe, expect, it } from 'vitest'
import { Effect, Layer } from 'effect'
import { QueryClientLive, QueryClientTag } from '@sleekstack/query'
import type { QueryClient } from '@tanstack/query-core'
import { configureRuntime, prefetchQueries } from '../index'

describe('prefetchQueries', () => {
  it('dehydrates prefetched queries, omits rejected ones, and disposes the request client', async () => {
    configureRuntime({ layer: Layer.empty })
    let client: QueryClient | undefined
    const request = Layer.tap(QueryClientLive(), (ctx) => Effect.sync(() => void (client = ctx.unsafeMap.get(QueryClientTag.key) as QueryClient)))
    const state = await prefetchQueries(
      [
        { queryKey: ['ok'], queryFn: () => Promise.resolve(1) },
        { queryKey: ['bad'], queryFn: () => Promise.reject(new Error('nope')), retry: false },
      ],
      { request },
    )
    expect(state.queries.map((q: { queryKey: unknown; state: { data: unknown } }) => [q.queryKey, q.state.data])).toEqual([[['ok'], 1]])
    expect(client!.getQueryCache().getAll()).toHaveLength(0)
  })

  it('rejects when the request scope fails to build', async () => {
    configureRuntime({ layer: Layer.empty })
    const request = QueryClientLive(() => { throw new Error('config down') })
    await expect(prefetchQueries([], { request })).rejects.toThrow(/config down/)
  })
})
