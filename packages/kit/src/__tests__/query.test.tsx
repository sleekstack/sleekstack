// @vitest-environment jsdom
import { Suspense, type ReactNode } from 'react'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { cachedQuery, layer, mutation, tag, type CachedQuery } from '../index'
import { LayerProvider, useMutation, useQuery, useQueryClient } from '../react'
import { renderStrict } from './renderStrict'

afterEach(cleanup)

const Api = tag<{ get(id: string): Promise<string>; set(id: string, v: string): Promise<void> }>('Api')
const fakeApi = () => {
  const db = new Map([['a', 'A']])
  const calls = { get: 0 }
  const api = { get: async (id: string) => { calls.get++; return db.get(id) ?? '?' }, set: async (id: string, v: string) => { db.set(id, v) } }
  return { calls, provide: [layer(Api, api)] }
}
const item = cachedQuery({ key: (id: string) => ['item', id], fetch: function* (id) { return (yield* Api).get(id) } })
const save = mutation({ run: function* (i: { id: string; v: string }) { return (yield* Api).set(i.id, i.v) } })
const tree = (child: ReactNode, p: Parameters<typeof LayerProvider>[0]['provide']) => (
  <Suspense fallback="loading"><LayerProvider provide={p}>{child}</LayerProvider></Suspense>
)
const Show = ({ q }: { q: CachedQuery<string> }) => {
  const { data, error, isPending } = useQuery(q)
  return <div data-testid="v">{isPending ? 'pending' : error ? `err:${error.code}` : data}</div>
}

describe('kit queries (R8)', () => {
  it('fetches once under StrictMode, resolving yield*ed Tags', async () => {
    const { calls, provide } = fakeApi()
    renderStrict(tree(<Show q={item('a')} />, provide))
    await screen.findByText('A')
    expect(calls.get).toBe(1)
    expect(item('a')).toBe(item('a'))
  })

  it('a missing Tag surfaces as error MissingDependency', async () => {
    renderStrict(tree(<Show q={item('a')} />, []))
    await screen.findByText('err:MissingDependency')
  })

  it('a mutation runs once and invalidation refetches', async () => {
    const { calls, provide } = fakeApi()
    function Edit() {
      const { mutate, data, isPending } = useMutation(save)
      const client = useQueryClient()
      return <button onClick={async () => { await mutate({ id: 'a', v: 'B' }); client.invalidate({ prefix: ['item'] }) }}>{isPending ? 'saving' : String(data === undefined)}</button>
    }
    renderStrict(tree(<><Show q={item('a')} /><Edit /></>, provide))
    await screen.findByText('A')
    await act(async () => fireEvent.click(screen.getByRole('button')))
    await screen.findByText('B')
    expect(calls.get).toBe(2)
  })

  it('mutate rejects with a SleekStackError when run throws', async () => {
    const bad = mutation({ run: function* (_: number) { throw new Error('boom') } })
    let mutate!: (n: number) => Promise<unknown>
    function M() { mutate = useMutation(bad).mutate; return null }
    renderStrict(tree(<M />, []))
    await act(async () => {})
    await expect(mutate(1)).rejects.toMatchObject({ code: 'Unknown', message: 'boom' })
  })
})
