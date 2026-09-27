/**
 * packages/react/src/__tests__/useService.test.tsx
 *
 * Failing test stubs for REACT-03, REACT-06, REACT-07.
 * These tests are RED — the new useService implementation does not exist yet.
 * Later plans turn them green.
 */
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderStrict } from './renderStrict'
import React, { Suspense } from 'react'
import { Context, Layer } from 'effect'
import { LayerProvider } from '../index'
import { useService } from '../index'
import * as ReactPackageExports from '../index'

// --- Test service setup ---

interface CounterServiceInterface {
  count: number
}

const CounterService = Context.GenericTag<CounterServiceInterface>('CounterService')
const CounterLayer = Layer.succeed(CounterService, { count: 42 })

// --- REACT-03 Tests ---

describe('useService — REACT-03: returns synchronously after first resolution (sync fast-path)', () => {
  it('[REACT-03] after first resolution, a second render returns the same service synchronously without re-suspending', async () => {
    let renderCount = 0
    let suspendCount = 0
    let resolvedCount = 0

    function TrackingConsumer() {
      renderCount++
      try {
        const svc = useService(CounterService)
        resolvedCount++
        return <div data-testid="count">{svc.count}</div>
      } catch (thrown) {
        if (thrown instanceof Promise) {
          suspendCount++
        }
        throw thrown
      }
    }

    const { rerender } = renderStrict(
      <LayerProvider provide={[CounterLayer]}>
        <Suspense fallback={<div data-testid="loading">loading</div>}>
          <TrackingConsumer />
        </Suspense>
      </LayerProvider>
    )

    // Wait for resolution
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('42')
    })

    const firstSuspendCount = suspendCount
    const firstResolvedCount = resolvedCount

    // Force a re-render
    rerender(
      <LayerProvider provide={[CounterLayer]}>
        <Suspense fallback={<div data-testid="loading">loading</div>}>
          <TrackingConsumer />
        </Suspense>
      </LayerProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('42')
    })

    // After first resolution, subsequent renders should not suspend again
    // The suspend count should not have increased
    expect(suspendCount).toBe(firstSuspendCount)
    expect(resolvedCount).toBeGreaterThan(firstResolvedCount)
  })
})

// --- REACT-06 Tests ---

describe('useService — REACT-06: throws descriptive error when no ancestor LayerProvider exists', () => {
  it('[REACT-06] calling useService with no ancestor LayerProvider throws an error containing "LayerProvider"', () => {
    const MissingProviderTag = Context.GenericTag<{ value: string }>('MissingProviderService')

    function ComponentWithoutProvider() {
      // This should throw synchronously since there is no context
      useService(MissingProviderTag)
      return <div>should not render</div>
    }

    expect(() => {
      // Render without any LayerProvider ancestor
      renderStrict(<ComponentWithoutProvider />)
    }).toThrow(/LayerProvider/i)
  })

  it('[REACT-06] the error message names the missing service by its Tag identifier (not a generic message)', () => {
    const NamedTag = Context.GenericTag<{ result: number }>('NamedMissingService')

    function ComponentWithoutProvider() {
      useService(NamedTag)
      return <div>should not render</div>
    }

    let errorMessage = ''
    try {
      renderStrict(<ComponentWithoutProvider />)
    } catch (e) {
      errorMessage = (e as Error).message
    }

    // The new implementation must name the specific service in the error message
    // Old prototype says "useService must be used within a LayerProvider" — too generic
    expect(errorMessage).toContain('NamedMissingService')
    expect(errorMessage).toContain('LayerProvider')
  })
})

// --- REACT-07 Tests ---

describe('@sleekstack/react public exports — REACT-07: Runtime, Scope, Fiber are NOT exported', () => {
  it('[REACT-07] the @sleekstack/react public entry exports LayerProvider and useService', () => {
    const exportKeys = Object.keys(ReactPackageExports)
    expect(exportKeys).toContain('LayerProvider')
    expect(exportKeys).toContain('useService')
  })

  it('[REACT-07] the @sleekstack/react public entry does NOT export any symbol named Runtime', () => {
    const exportKeys = Object.keys(ReactPackageExports)
    expect(exportKeys).not.toContain('Runtime')
  })

  it('[REACT-07] the @sleekstack/react public entry does NOT export any symbol named Scope', () => {
    const exportKeys = Object.keys(ReactPackageExports)
    expect(exportKeys).not.toContain('Scope')
  })

  it('[REACT-07] the @sleekstack/react public entry does NOT export any symbol named Fiber', () => {
    const exportKeys = Object.keys(ReactPackageExports)
    expect(exportKeys).not.toContain('Fiber')
  })

  it('[REACT-07] the @sleekstack/react public entry does NOT export prototype-era symbols (EffectLib, createService)', () => {
    // Old prototype exports EffectLib — the new implementation must NOT export it
    const exportKeys = Object.keys(ReactPackageExports)
    expect(exportKeys).not.toContain('EffectLib')
    expect(exportKeys).not.toContain('createService')
    expect(exportKeys).not.toContain('layer')
  })
})

// --- R9 (task .7): status cache, errors ---

describe('useService — R9 status cache and errors', () => {
  class Boundary extends React.Component<{ id: string; children: React.ReactNode }, { error: unknown }> {
    state = { error: undefined as unknown }
    static getDerivedStateFromError(error: unknown) {
      return { error }
    }
    render() {
      return this.state.error !== undefined ? <div data-testid={this.props.id}>{String((this.state.error as Error).message ?? this.state.error)}</div> : this.props.children
    }
  }

  it('suspends once, then returns an undefined-valued service synchronously', async () => {
    const Undef = Context.GenericTag<undefined>('UndefinedService')
    let suspends = 0
    function C() {
      try {
        const v = useService(Undef)
        return <div data-testid="undef">{v === undefined ? 'undefined' : 'defined'}</div>
      } catch (t) {
        if (t instanceof Promise) suspends++
        throw t
      }
    }
    const ui = (
      <LayerProvider provide={[Layer.succeed(Undef, undefined)]}>
        <Suspense fallback={null}>
          <C />
        </Suspense>
      </LayerProvider>
    )
    const { rerender } = renderStrict(ui)
    await waitFor(() => expect(screen.getByTestId('undef').textContent).toBe('undefined'))
    const before = suspends
    expect(before).toBeGreaterThan(0)
    rerender(ui)
    expect(screen.getByTestId('undef').textContent).toBe('undefined')
    expect(suspends).toBe(before)
  })

  it('acquisition failure reaches the nearest ErrorBoundary', async () => {
    const Failing = Context.GenericTag<{ x: number }>('FailingService')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function C() {
      useService(Failing)
      return <div>never</div>
    }
    renderStrict(
      <LayerProvider provide={[Layer.fail(new Error('acquire boom')) as never]}>
        <Boundary id="caught-X">
          <Suspense fallback={null}>
            <C />
          </Suspense>
        </Boundary>
      </LayerProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('caught-X').textContent).toContain('acquire boom'))
    spy.mockRestore()
  })

  it('a Tag no provider supplies throws a descriptive error naming it', async () => {
    const Absent = Context.GenericTag<{ x: number }>('AbsentService')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function C() {
      useService(Absent)
      return <div>never</div>
    }
    renderStrict(
      <LayerProvider provide={[CounterLayer]}>
        <Boundary id="caught-Y">
          <Suspense fallback={null}>
            <C />
          </Suspense>
        </Boundary>
      </LayerProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('caught-Y').textContent).toMatch(/"AbsentService" is not provided.*provide prop.*LayerProvider/))
    spy.mockRestore()
  })
})
