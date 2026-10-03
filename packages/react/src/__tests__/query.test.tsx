/**
 * packages/react/src/__tests__/query.test.tsx
 *
 * QueryProvider (fn-21 task .2, R3): the scope's QueryClient reaches @tanstack/react-query hooks,
 * one client per LayerProvider root, cleared when the root unmounts.
 */
import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import React, { Suspense } from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { QueryClientLive } from '@sleekstack/query'
import * as api from '../index'

afterEach(cleanup)

const clients: QueryClient[] = []
const View = ({ id }: { id: string }) => {
  clients.push(useQueryClient())
  const { data } = useQuery({ queryKey: ['item'], queryFn: async () => `data-${id}` })
  return <span data-testid={id}>{data ?? 'loading'}</span>
}
const Root = ({ id }: { id: string }) => (
  <api.LayerProvider provide={[QueryClientLive()]}>
    <Suspense fallback={null}><api.QueryProvider><View id={id} /></api.QueryProvider></Suspense>
  </api.LayerProvider>
)

describe('QueryProvider', () => {
  it('supplies the scope client per root and clears it on root unmount', async () => {
    clients.length = 0
    const a = render(<Root id="a" />)
    render(<Root id="b" />)
    await waitFor(() => expect(screen.getByTestId('a').textContent).toBe('data-a'))
    await waitFor(() => expect(screen.getByTestId('b').textContent).toBe('data-b'))
    const ca = clients.find((c) => c.getQueryData(['item']) === 'data-a')!
    const cb = clients.find((c) => c.getQueryData(['item']) === 'data-b')!
    expect(ca).toBeDefined()
    expect(ca).not.toBe(cb)
    a.unmount()
    await waitFor(() => expect(ca.getQueryCache().getAll()).toHaveLength(0))
    expect(cb.getQueryData(['item'])).toBe('data-b')
  })

  it('no longer exports the old query hooks', () => {
    for (const name of ['useQuery', 'useMutation', 'HydrateQueries', 'useQueries']) expect(name in api).toBe(false)
  })
})
