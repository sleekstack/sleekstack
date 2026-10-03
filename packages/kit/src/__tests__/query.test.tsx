// @vitest-environment jsdom
import { Suspense, type ReactNode } from 'react'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { cachedQuery, layer, mutation, tag, type CachedQuery } from '../index'
import { LayerProvider, QueryProvider, useMutation, useQuery, useQueryClient } from '../react'
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
  it('resolves yield*ed Tags under StrictMode; the remount aborts and refetches the first fetch', async () => {
    const { calls, provide } = fakeApi()
    renderStrict(tree(<Show q={item('a')} />, provide))
    await screen.findByText('A')
    // TanStack cancels an unobserved fetch that consumed its AbortSignal, so StrictMode's remount fetches again.
    expect(calls.get).toBe(2)
    expect(item('a')).toBe(item('a'))
  })

  it('under QueryProvider, a nested provider supplies the Tags', async () => {
    const { provide } = fakeApi()
    renderStrict(tree(<LayerProvider provide={provide}><QueryProvider><Show q={item('a')} /></QueryProvider></LayerProvider>, []))
    await screen.findByText('A')
  })

  it('a service throwing "Service not found" is not a MissingDependency', async () => {
    const Bad = tag<{ get(): string }>('Bad')
    const q = cachedQuery({ key: () => ['bad'], fetch: function* () { return (yield* Bad).get() } })
    renderStrict(tree(<Show q={q(undefined)} />, [layer(Bad, { get: () => { throw new Error('Service not found: Bad') } })]))
    await screen.findByText('err:Unknown')
  })

  it('a throwing key surfaces as a SleekStackError', () => {
    const q = cachedQuery({ key: (): string[] => { throw new Error('bad key') }, fetch: function* () { return 1 } })
    expect(() => q(undefined)).toThrow(expect.objectContaining({ name: 'SleekStackError', message: 'bad key' }))
  })

  it('queries and mutations resolve a component-lifetime Tag', async () => {
    const Comp = tag<{ v(): string }>('CompLifetime')
    const q = cachedQuery({ key: () => ['comp'], fetch: function* () { return (yield* Comp).v() } })
    const m = mutation({ run: function* (_: number) { return (yield* Comp).v() } })
    let mutate!: (n: number) => Promise<string>
    function M() { mutate = useMutation(m).mutate; return null }
    renderStrict(tree(<><Show q={q(undefined)} /><M /></>, [layer(Comp, { v: () => 'C' }, [], { lifetime: 'component' })]))
    await screen.findByText('C')
    await expect(mutate(1)).resolves.toBe('C')
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
    expect(calls.get).toBe(3)
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
