/**
 * packages/react/src/__tests__/atoms.test.tsx
 *
 * Atom hooks over the per-LayerProvider AtomStore (fn-7 task .3, R3/R4).
 */
import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { createRoot } from 'react-dom/client'
import React, { Component, Suspense, type ReactNode } from 'react'
import { Context, Effect, Layer } from 'effect'
import { Atom, MissingDependency, PrivateDependency, Result } from '@sleekstack/core'
import { renderStrict } from './renderStrict'
import { AtomsClientOnly, LayerProvider, useAtom, useAtomSet, useAtomSuspense, useAtomValue } from '../index'

const Db = Context.GenericTag<{ name: string }>('AtomDb')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

class Boundary extends Component<{ children: ReactNode }, { error?: unknown }> {
  state: { error?: unknown } = {}
  static getDerivedStateFromError(error: unknown) { return { error } }
  render() { return this.state.error ? <div data-testid="error">{String((this.state.error as Error).message ?? this.state.error)}</div> : this.props.children }
}

afterEach(() => vi.unstubAllGlobals())

describe('atom hooks', () => {
  it('re-renders only when its atom value changes', async () => {
    const a = Atom.make(0)
    const b = Atom.make(0)
    let renders = 0
    let setB!: (n: number) => void
    let setA!: (n: number) => void
    const Reader = () => { renders++; return <span data-testid="a">{useAtomValue(a)}</span> }
    const Writer = () => { setA = useAtomSet(a); setB = useAtomSet(b); return null }
    render(<LayerProvider provide={[]}><Suspense fallback={null}><Reader /><Writer /></Suspense></LayerProvider>)
    await screen.findByTestId('a')
    const base = renders
    act(() => setB(1))
    act(() => setA(0)) // same value: no change
    expect(renders).toBe(base)
    act(() => setA(5))
    expect(screen.getByTestId('a').textContent).toBe('5')
    expect(renders).toBe(base + 1)
  })

  it('StrictMode: acquires once, and unmount interrupts the atom before service finalizers', async () => {
    const log: string[] = []
    let acquired = 0
    const DbLive = Layer.scoped(Db, Effect.acquireRelease(Effect.succeed({ name: 'db' }), () => Effect.sync(() => log.push('service-finalizer'))))
    const running = Atom.make(Effect.gen(function* () {
      const db = yield* Db
      acquired++
      yield* Effect.addFinalizer(() => Effect.sync(() => log.push('atom-interrupted')))
      return db.name
    }).pipe(Effect.zipLeft(Effect.never), Effect.scoped))
    const value = Atom.make(Effect.gen(function* () { return (yield* Db).name }))
    const View = () => { useAtomValue(running); return <span data-testid="v">{useAtomSuspense(value).value}</span> }
    const { unmount } = renderStrict(<LayerProvider provide={[DbLive]}><Suspense fallback={null}><View /></Suspense></LayerProvider>)
    await screen.findByTestId('v')
    expect(acquired).toBe(1)
    unmount()
    await waitFor(() => expect(log).toEqual(['atom-interrupted', 'service-finalizer']))
  })

  it('a suspending acquisition longer than idleTTL completes exactly once; an abandoned render releases after settle + idleTTL', async () => {
    let starts = 0
    let released = 0
    // get.addFinalizer runs when the store removes the node
    const slow = () => Atom.make((get) => {
      get.addFinalizer(() => released++)
      return Effect.sync(() => starts++).pipe(Effect.zipRight(Effect.promise(() => sleep(600))), Effect.as('done'))
    })
    const committed = slow()
    const View = ({ atom }: { atom: Atom.Atom<Result.Result<string, unknown>> }) => <span data-testid="s">{useAtomSuspense(atom).value}</span>
    render(<LayerProvider provide={[]}><Suspense fallback={null}><View atom={committed} /></Suspense></LayerProvider>)
    await waitFor(() => expect(screen.getByTestId('s').textContent).toBe('done'), { timeout: 2000 })
    expect(starts).toBe(1)

    // Abandoned: the suspending child is removed before its load settles.
    starts = 0
    released = 0
    const abandoned = slow()
    const Host = ({ show }: { show: boolean }) => <LayerProvider provide={[]}><Suspense fallback={<i data-testid="fb" />}>{show ? <View atom={abandoned} /> : null}</Suspense></LayerProvider>
    const { rerender } = render(<Host show />)
    await waitFor(() => expect(starts).toBe(1))
    rerender(<Host show={false} />)
    await sleep(700) // settled, still within idleTTL
    expect(released).toBe(0)
    await waitFor(() => expect(released).toBe(1), { timeout: 1000 })
    expect(starts).toBe(1)
  })

  it('nested providers keep separate state and resolve R from the nearest provider', async () => {
    const count = Atom.make(0)
    const name = Atom.make(Effect.map(Db, (d) => d.name))
    let setInner!: (n: number) => void
    const Show = ({ id }: { id: string }) => {
      const [n, set] = useAtom(count)
      if (id === 'inner') setInner = set
      return <span data-testid={id}>{`${n}:${useAtomSuspense(name).value}`}</span>
    }
    render(
      <LayerProvider provide={[Layer.succeed(Db, { name: 'outer' })]}>
        <Suspense fallback={null}>
          <Show id="outer" />
          <LayerProvider provide={[Layer.succeed(Db, { name: 'inner' })]}>
            <Suspense fallback={null}><Show id="inner" /></Suspense>
          </LayerProvider>
        </Suspense>
      </LayerProvider>,
    )
    await screen.findByTestId('inner')
    await screen.findByTestId('outer')
    act(() => setInner(3))
    expect(screen.getByTestId('inner').textContent).toBe('3:inner')
    expect(screen.getByTestId('outer').textContent).toBe('0:outer')
  })

  it('useAtomSuspense throws a stable promise and rethrows the squashed failure', async () => {
    const thrown: unknown[] = []
    const slow = Atom.make(Effect.promise(() => sleep(50)).pipe(Effect.as(1)))
    const Catch = () => {
      try { return <span data-testid="ok">{useAtomSuspense(slow).value}</span> } catch (e) { thrown.push(e); throw e }
    }
    renderStrict(<LayerProvider provide={[]}><Suspense fallback={null}><Catch /></Suspense></LayerProvider>)
    await screen.findByTestId('ok')
    const promises = thrown.filter((t) => t instanceof Promise)
    expect(new Set(promises).size).toBe(2) // the provider's scope promise, then one promise for the atom

    const failing = Atom.make(Effect.fail(new Error('boom')))
    const Fail = () => <span>{String(useAtomSuspense(failing).value)}</span>
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<LayerProvider provide={[]}><Boundary><Suspense fallback={null}><Fail /></Suspense></Boundary></LayerProvider>)
    expect((await screen.findByTestId('error')).textContent).toBe('boom')
  })

  it('throws outside a provider and AtomsClientOnly during a server render', () => {
    const a = Atom.make(1)
    const View = () => <span>{useAtomValue(a)}</span>
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<View />)).toThrow(/needs a <LayerProvider>/)
    vi.stubGlobal('window', undefined)
    expect(() => renderToString(<LayerProvider provide={[]}><View /></LayerProvider>)).toThrow(AtomsClientOnly)
  })

  it('a selector returning an Effect keeps it as a value', async () => {
    const task = Effect.sync(() => { throw new Error('must not run') })
    const holder = Atom.make({ task })
    let selected: unknown
    const View = () => { selected = useAtomValue(holder, (h) => h.task); return <i data-testid="sel" /> }
    render(<LayerProvider provide={[]}><Suspense fallback={null}><View /></Suspense></LayerProvider>)
    await screen.findByTestId('sel')
    expect(selected).toBe(task)
  })

  it('a zero-idleTTL atom survives the Suspense retry and loads once', async () => {
    let starts = 0
    const zero = Atom.setIdleTTL(Atom.make(Effect.suspend(() => { starts++; return Effect.promise(() => sleep(10)) }).pipe(Effect.as('z'))), 0)
    const View = () => <span data-testid="z">{useAtomSuspense(zero).value}</span>
    render(<LayerProvider provide={[]}><Suspense fallback={null}><View /></Suspense></LayerProvider>)
    await screen.findByTestId('z')
    expect(starts).toBe(1)
  })

  it('sibling providers with identical entries keep separate atom state', async () => {
    const count = Atom.make(0)
    const setters: Array<(n: number) => void> = []
    const Show = ({ id }: { id: string }) => { const [n, set] = useAtom(count); setters.push(set); return <span data-testid={id}>{n}</span> }
    render(<>
      <LayerProvider provide={[]}><Suspense fallback={null}><Show id="s1" /></Suspense></LayerProvider>
      <LayerProvider provide={[]}><Suspense fallback={null}><Show id="s2" /></Suspense></LayerProvider>
    </>)
    await screen.findByTestId('s1')
    await screen.findByTestId('s2')
    act(() => setters[0]!(5))
    expect(screen.getByTestId('s1').textContent).toBe('5')
    expect(screen.getByTestId('s2').textContent).toBe('0')
  })

  it('sibling providers under one Suspense are isolated before their children mount', async () => {
    const count = Atom.make(0)
    let gate: Promise<void> | null = sleep(20).then(() => { gate = null })
    const Show = ({ id, write }: { id: string; write?: number }) => {
      if (gate) throw gate
      const [n, set] = useAtom(count)
      React.useEffect(() => { if (write !== undefined) set(write) }, [])
      return <span data-testid={id}>{n}</span>
    }
    renderStrict(<Suspense fallback={null}>
      <LayerProvider provide={[]}><Show id="t1" /></LayerProvider>
      <LayerProvider provide={[]}><Show id="t2" write={7} /></LayerProvider>
    </Suspense>)
    await waitFor(() => expect(screen.getByTestId('t2').textContent).toBe('7'))
    expect(screen.getByTestId('t1').textContent).toBe('0')
  })

  it('sibling providers stay isolated across a time-sliced render', async () => {
    const count = Atom.make(0)
    const Slow = () => { const end = Date.now() + 30; while (Date.now() < end); return null }
    const Show = ({ id, write }: { id: string; write?: number }) => {
      const [n, set] = useAtom(count)
      React.useEffect(() => { if (write !== undefined) set(write) }, [])
      return <span data-testid={id}>{n}</span>
    }
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false // let React yield between slices
    React.startTransition(() => root.render(<Suspense fallback={null}>
      <LayerProvider key="a" provide={[]}><Show id="c1" /></LayerProvider>
      <Slow />
      <LayerProvider key="b" provide={[]}><Show id="c2" write={7} /></LayerProvider>
    </Suspense>))
    try {
      await waitFor(() => expect(screen.getByTestId('c2').textContent).toBe('7'))
      expect(screen.getByTestId('c1').textContent).toBe('0')
    } finally {
      ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
      root.unmount()
    }
  })

  it('a provider rendered by a component beneath an outer Suspense acquires once and resolves', async () => {
    let acquired = 0
    const DbLive = Layer.effect(Db, Effect.sync(() => { acquired++ }).pipe(Effect.zipRight(Effect.sleep(50)), Effect.as({ name: 'db' })))
    const name = Atom.make(Effect.map(Db, (d) => d.name))
    const Show = () => <span data-testid="name">{useAtomSuspense(name).value}</span>
    const App = () => <LayerProvider provide={[DbLive]}><Show /></LayerProvider>
    render(<Suspense fallback={null}><App /></Suspense>)
    expect((await screen.findByTestId('name', {}, { timeout: 2000 })).textContent).toBe('db')
    expect(acquired).toBe(1)
  })

  it('sequential suspending atoms longer than the retry window each build once', async () => {
    let builds = 0
    const slow = (v: string) => Atom.make(Effect.sync(() => { builds++ }).pipe(Effect.zipRight(Effect.sleep(1000)), Effect.as(v)))
    const a = slow('a')
    const b = slow('b')
    const Both = () => <span data-testid="ab">{useAtomSuspense(a).value}{useAtomSuspense(b).value}</span>
    render(<LayerProvider provide={[]}><Suspense fallback={null}><Both /></Suspense></LayerProvider>)
    expect((await screen.findByTestId('ab', {}, { timeout: 5000 })).textContent).toBe('ab')
    expect(builds).toBe(2)
  }, 8000)

  it('types: Effect and Stream atom Results include scope lookup errors', () => {
    const a = Atom.make(Effect.succeed(1))
    type E = typeof a extends Atom.Atom<Result.Result<number, infer X>> ? X : never
    expectTypeOf<MissingDependency>().toExtend<E>()
    expectTypeOf<PrivateDependency>().toExtend<E>()
  })
})
