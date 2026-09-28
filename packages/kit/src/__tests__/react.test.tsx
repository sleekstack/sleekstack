// @vitest-environment jsdom
import { Component, Suspense, type ReactNode } from 'react'
import { act, cleanup, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { layer, module, tag, withCleanup, SleekStackError, type FinalizerError } from '../index'
import { LayerProvider, useService, useServices } from '../react'
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

const A = tag<string>('A')
const B = tag<number>('B')

function Show({ t }: { t: typeof A }) {
  return <div data-testid="v">{useService(t)}</div>
}

const tree = (provide: Parameters<typeof LayerProvider>[0]['provide'], child: ReactNode, onFinalizerError?: (e: FinalizerError) => void) => (
  <Boundary>
    <Suspense fallback="loading">
      <LayerProvider provide={provide} {...(onFinalizerError && { onFinalizerError })}>{child}</LayerProvider>
    </Suspense>
  </Boundary>
)

describe('@sleekstack/kit/react', () => {
  it('StrictMode: 1 acquire / 1 release for a component Layer', async () => {
    const acquire = vi.fn(), release = vi.fn()
    const provide = [layer(A, () => { acquire(); return withCleanup('a', release) }, [], { lifetime: 'component' })]
    const r = renderStrict(tree(provide, <Show t={A} />))
    await screen.findByText('a')
    r.unmount()
    await waitFor(() => expect(release).toHaveBeenCalledTimes(1))
    expect(acquire).toHaveBeenCalledTimes(1)
  })

  it('useServices returns in order and warns on length change', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    function Both({ n }: { n: number }) {
      const vals = useServices(n === 2 ? [A, B] : [A])
      return <div data-testid="v">{vals.join(',')}</div>
    }
    const provide = [layer(A, 'a'), layer(B, 2)]
    const r = renderStrict(tree(provide, <Both n={2} />))
    await screen.findByText('a,2')
    r.rerender(tree(provide, <Both n={1} />))
    await screen.findByText('a')
    expect(warn.mock.calls.some(([m]) => String(m).includes('length changed'))).toBe(true)
    warn.mockRestore()
  })

  it.each([
    ['failing Layer', [layer(A, () => { throw new Error('boom') })], 'LayerFailed'],
    ['duplicate Tag', [layer(A, 'x'), layer(tag<string>('A'), 'y')], 'DuplicateTag'],
  ] as const)('%s reaches the boundary as SleekStackError', async (_, provide, code) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderStrict(tree(provide as never, <Show t={A} />))
    expect((await screen.findByTestId('err')).textContent).toBe(`true:${code}`)
    vi.restoreAllMocks()
  })

  it('child provider with the same key shadows the parent', async () => {
    renderStrict(tree([layer(A, 'parent')], <LayerProvider provide={[layer(A, 'child')]}><Suspense fallback="l"><Show t={A} /></Suspense></LayerProvider>))
    await screen.findByText('child')
  })

  it('module local Layer shadows an import', async () => {
    const lib = module({ name: 'lib', provide: [layer(A, 'imported')], exports: [A] })
    const app = module({ name: 'app', imports: [lib], provide: [layer(A, 'local')] })
    renderStrict(tree([app], <Show t={A} />))
    await screen.findByText('local')
  })

  it('onFinalizerError receives a plain FinalizerError', async () => {
    const seen: FinalizerError[] = []
    const provide = [layer(A, () => withCleanup('a', () => { throw new Error('cleanup broke') }), [], { lifetime: 'component' })]
    const r = renderStrict(tree(provide, <Show t={A} />, (e) => seen.push(e)))
    await screen.findByText('a')
    await act(async () => r.unmount())
    await waitFor(() => expect(seen).toHaveLength(1))
    expect(seen[0]!.message).toContain('cleanup broke')
    expect(seen[0]).not.toBeInstanceOf(Error)
  })
})
