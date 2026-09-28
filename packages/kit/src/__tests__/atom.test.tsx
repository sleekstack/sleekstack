// @vitest-environment jsdom
import { Component, Suspense, type ReactNode } from 'react'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { atom, layer, tag, SleekStackError, type Atom } from '../index'
import { LayerProvider, useAtom, useAtomSet, useAtomValue } from '../react'
import { renderStrict } from './renderStrict'

afterEach(cleanup)

class Boundary extends Component<{ children: ReactNode }, { error?: unknown }> {
  state: { error?: unknown } = {}
  static getDerivedStateFromError(error: unknown) { return { error } }
  render() {
    const e = this.state.error as SleekStackError | undefined
    return e ? <div data-testid="err">{`${e instanceof SleekStackError}:${e.code}`}</div> : this.props.children
  }
}

const Api = tag<{ double(n: number): Promise<number> }>('Api')
const provide = [layer(Api, { double: async (n: number) => n * 2 })]
const tree = (child: ReactNode, p: Parameters<typeof LayerProvider>[0]['provide'] = provide) => (
  <Boundary><Suspense fallback="loading"><LayerProvider provide={p}>{child}</LayerProvider></Suspense></Boundary>
)
const Show = ({ a }: { a: Atom<unknown> }) => <div data-testid="v">{String(useAtomValue(a))}</div>

describe('kit atoms', () => {
  it('resolves deps, awaits async fn, and recomputes derived atoms on write', async () => {
    const n = atom(1)
    const doubled = atom((api, get) => api.double(get(n)), [Api])
    const plusOne = atom((get) => get(doubled) + 1)
    function Inc() {
      const [v, set] = useAtom(n)
      const add = useAtomSet(n)
      return <><button onClick={() => set(v + 1)}>set</button><button onClick={() => add((p) => p + 10)}>add</button></>
    }
    renderStrict(tree(<><Inc /><Show a={plusOne} /></>))
    expect((await screen.findByTestId('v')).textContent).toBe('3')
    await act(async () => fireEvent.click(screen.getByText('set')))
    await screen.findByText('5')
    await act(async () => fireEvent.click(screen.getByText('add')))
    await screen.findByText('25')
  })

  it('an async fn reading a loading atom waits for it', async () => {
    const slow = atom(async () => { await new Promise((r) => setTimeout(r, 20)); return 1 })
    const next = atom(async (get) => { await null; return get(slow) + 1 })
    renderStrict(tree(<Show a={next} />))
    await screen.findByText('2')
  })

  it('a reader can switch between a writable and a derived atom', async () => {
    const w = atom(1)
    const d = atom(() => 2)
    const r = renderStrict(tree(<Show a={w} />))
    await screen.findByText('1')
    r.rerender(tree(<Show a={d} />))
    await screen.findByText('2')
    r.rerender(tree(<Show a={w} />))
    await screen.findByText('1')
  })

  it.each([
    ['missing dep', atom((api) => api.double(1), [Api]), [], 'MissingDependency'],
    ['rejected fn', atom(async () => { throw new Error('boom') }), provide, 'Unknown'],
  ] as const)('%s reaches the boundary as SleekStackError', async (_, a, p, code) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderStrict(tree(<Show a={a} />, p as never))
    expect((await screen.findByTestId('err')).textContent).toBe(`true:${code}`)
    vi.restoreAllMocks()
  })

  it('a read cycle throws AtomCycle', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const a: Atom<number> = atom((get): number => get(b))
    const b: Atom<number> = atom((get): number => get(a))
    renderStrict(tree(<Show a={a} />))
    expect((await screen.findByTestId('err')).textContent).toBe('true:AtomCycle')
    vi.restoreAllMocks()
  })

  it('family returns the same atom for equal keys', () => {
    const f = atom.family((k: number, api) => api.double(k), [Api])
    expect(f(1)).toBe(f(1))
    expect(f(1)).not.toBe(f(2))
  })
})
