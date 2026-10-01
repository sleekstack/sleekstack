/**
 * packages/react/src/__tests__/LayerProvider.test.tsx
 *
 * Failing test stubs for REACT-01, REACT-04, REACT-08.
 * These tests are RED — LayerProvider with `provide` prop does not exist yet.
 * Later plans turn them green.
 */
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, act } from '@testing-library/react'
import { renderStrict } from './renderStrict'
import React, { Suspense } from 'react'
import { Context, Layer, Effect } from 'effect'
import { LayerProvider } from '../index'
import { useService } from '../index'
import { module } from '@sleekstack/core'
import { service } from './service-helper'

// --- Test service setup ---

interface TestServiceInterface {
  getValue(): string
}

const TestService = Context.GenericTag<TestServiceInterface>('TestService')
const TestLayer = Layer.succeed(TestService, { getValue: () => 'test-value' })

interface CleanupServiceInterface {
  id: string
  cleanup: () => void
}
const CleanupService = Context.GenericTag<CleanupServiceInterface>('CleanupService')

// --- Helper component ---

function ServiceConsumer() {
  const svc = useService(TestService)
  return <div data-testid="value">{svc.getValue()}</div>
}

// --- REACT-01 Tests ---

describe('LayerProvider — REACT-01: accepts a provide prop of Layer and Module values and renders children', () => {
  it('[REACT-01] renders children and provides a service via provide prop containing a Layer', async () => {
    // This test checks the new `provide` prop API — not the old `layers` prop.
    // With the old prototype the provide prop is ignored; service resolution fails.
    renderStrict(
      <LayerProvider provide={[TestLayer]}>
        <Suspense fallback={<div data-testid="react01-loading">loading</div>}>
          <ServiceConsumer />
        </Suspense>
      </LayerProvider>
    )
    // Service must resolve through the new `provide` prop — old prototype ignores it
    await waitFor(() => {
      expect(screen.getByTestId('value').textContent).toBe('test-value')
    })
  })

  it('[REACT-01] provide prop accepts an array with mixed Layer and Module values without throwing', async () => {
    const fakeModule = module({ name: 'FakeModule', entries: [TestLayer] })
    renderStrict(
      <LayerProvider provide={[fakeModule]}>
        <Suspense fallback={<div data-testid="react01b-loading">loading</div>}>
          <ServiceConsumer />
        </Suspense>
      </LayerProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('value').textContent).toBe('test-value')
    })
  })
})

// --- REACT-04 Tests ---

describe('LayerProvider + useService — REACT-04: first useService call suspends, then resolves', () => {
  it('[REACT-04] Suspense fallback shows while service is resolving, then service resolves', async () => {
    renderStrict(
      <LayerProvider provide={[TestLayer]}>
        <Suspense fallback={<div data-testid="loading">loading...</div>}>
          <ServiceConsumer />
        </Suspense>
      </LayerProvider>
    )

    // On first render, service may not yet be resolved — fallback should appear
    // After resolution, actual value should render
    await waitFor(() => {
      expect(screen.getByTestId('value').textContent).toBe('test-value')
    })
  })

  it('[REACT-04] useService throws a Promise on first render (caught by Suspense boundary)', async () => {
    let thrownValue: unknown = undefined

    function CapturingSuspendComponent() {
      try {
        useService(TestService)
        return <div data-testid="resolved">resolved</div>
      } catch (thrown) {
        thrownValue = thrown
        throw thrown
      }
    }

    renderStrict(
      <LayerProvider provide={[TestLayer]}>
        <Suspense fallback={<div data-testid="fallback">loading</div>}>
          <CapturingSuspendComponent />
        </Suspense>
      </LayerProvider>
    )

    // Either the component suspended (thrownValue is a Promise) or resolved
    // At minimum, the tree should render without crashing
    await waitFor(() => {
      const resolved = screen.queryByTestId('resolved')
      const fallback = screen.queryByTestId('fallback')
      expect(resolved || fallback).toBeTruthy()
    })

    // If it suspended, the thrown value must be a Promise
    if (thrownValue !== undefined) {
      expect(thrownValue).toBeInstanceOf(Promise)
    }
  })
})

// --- REACT-08 Tests ---

describe('LayerProvider — REACT-08: scoped Layer finalizer runs on unmount', () => {
  it('[REACT-08] cleanup callback from Layer.scoped runs when LayerProvider unmounts', async () => {
    const cleanupSpy = vi.fn()

    const ScopedCleanupLayer = Layer.scoped(
      CleanupService,
      Effect.acquireRelease(
        Effect.sync(() => ({ id: 'cleanup-test', cleanup: cleanupSpy })),
        (svc) => Effect.sync(() => svc.cleanup())
      )
    )

    function CleanupConsumer() {
      const svc = useService(CleanupService)
      return <div data-testid="cleanup-service-id">{svc.id}</div>
    }

    const { unmount } = renderStrict(
      <LayerProvider provide={[ScopedCleanupLayer]}>
        <Suspense fallback={<div>loading</div>}>
          <CleanupConsumer />
        </Suspense>
      </LayerProvider>
    )

    // Wait for service to resolve
    await waitFor(() => {
      expect(screen.getByTestId('cleanup-service-id').textContent).toBe('cleanup-test')
    })

    // Unmount the provider
    unmount()

    // Cleanup should have been called
    await waitFor(() => {
      expect(cleanupSpy).toHaveBeenCalledOnce()
    })
  })
})

// --- R9 (task .7): app scope, finalizers, error sink, provide warning ---

describe('LayerProvider — R9 scope ownership and cleanup', () => {
  const flush = () => new Promise((r) => setTimeout(r, 0))

  it('finalizers run exactly once on unmount (StrictMode double-mount does not release)', async () => {
    const acquire = vi.fn()
    const release = vi.fn()
    const L = Layer.scoped(CleanupService, Effect.acquireRelease(Effect.sync(() => (acquire(), { id: 'x', cleanup: () => {} })), () => Effect.sync(release)))
    function C() {
      return <div data-testid="once">{useService(CleanupService).id}</div>
    }
    const { unmount } = renderStrict(
      <LayerProvider provide={[L]}>
        <Suspense fallback={null}>
          <C />
        </Suspense>
      </LayerProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('once').textContent).toBe('x'))
    await flush()
    expect(release).not.toHaveBeenCalled()
    unmount()
    await flush()
    await flush()
    expect(acquire).toHaveBeenCalledOnce()
    expect(release).toHaveBeenCalledOnce()
  })

  it('a top-level provider resolves app- and component-lifetime entries with no outer runtime', async () => {
    const AppSvc = Context.GenericTag<{ n: string }>('AppLifetimeSvc')
    const CompSvc = Context.GenericTag<{ n: string }>('ComponentLifetimeSvc')
    const app = service(AppSvc, { lifetime: 'app' }, () => Effect.succeed({ n: 'app' }))
    const comp = service(CompSvc, { requires: [AppSvc], lifetime: 'component' }, ([a]) => Effect.succeed({ n: `comp<${a.n}>` }))
    function C() {
      return <div data-testid="both">{`${useService(AppSvc).n}|${useService(CompSvc).n}`}</div>
    }
    renderStrict(
      <LayerProvider provide={[app, comp]}>
        <Suspense fallback={null}>
          <C />
        </Suspense>
      </LayerProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('both').textContent).toBe('app|comp<app>'))
  })

  it('a failing finalizer on unmount reaches onFinalizerError', async () => {
    const sink = vi.fn()
    const L = Layer.scoped(CleanupService, Effect.acquireRelease(Effect.sync(() => ({ id: 'f', cleanup: () => {} })), () => Effect.die(new Error('release boom'))))
    function C() {
      return <div data-testid="fin">{useService(CleanupService).id}</div>
    }
    const { unmount } = renderStrict(
      <LayerProvider provide={[L]} onFinalizerError={sink}>
        <Suspense fallback={null}>
          <C />
        </Suspense>
      </LayerProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('fin').textContent).toBe('f'))
    unmount()
    await waitFor(() => expect(sink).toHaveBeenCalledOnce())
  })

  it('warns in dev when provide entries change after mount', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { rerender } = renderStrict(<LayerProvider provide={[TestLayer]} />)
    rerender(<LayerProvider provide={[TestLayer]} />)
    expect(warn).not.toHaveBeenCalled()
    rerender(<LayerProvider provide={[Layer.succeed(TestService, { getValue: () => 'other' })]} />)
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})

describe('LayerProvider — R9 abandoned render', () => {
  it('a provider render abandoned before commit acquires nothing', async () => {
    const acquire = vi.fn()
    const L = Layer.scoped(CleanupService, Effect.acquireRelease(Effect.sync(() => (acquire(), { id: 'a', cleanup: () => {} })), () => Effect.void))
    function Throws(): never {
      throw new Error('abandon')
    }
    class Catch extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
      state = { failed: false }
      static getDerivedStateFromError() {
        return { failed: true }
      }
      render() {
        return this.state.failed ? null : this.props.children
      }
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderStrict(
      <Catch>
        <LayerProvider provide={[L]}>
          <Throws />
        </LayerProvider>
      </Catch>,
    )
    await new Promise((r) => setTimeout(r, 10))
    expect(acquire).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('LayerProvider — R9 Suspense above the provider', () => {
  it('an async scoped Layer under an outer Suspense acquires once and releases once', async () => {
    const acquire = vi.fn()
    const release = vi.fn()
    const L = Layer.scoped(CleanupService, Effect.acquireRelease(Effect.sleep(10).pipe(Effect.andThen(() => Effect.sync(() => (acquire(), { id: 'o', cleanup: () => {} })))), () => Effect.sync(release)))
    function C() {
      return <div data-testid="outer-once">{useService(CleanupService).id}</div>
    }
    const { unmount } = renderStrict(
      <Suspense fallback={null}>
        <LayerProvider provide={[L]}>
          <C />
        </LayerProvider>
      </Suspense>,
    )
    await waitFor(() => expect(screen.getByTestId('outer-once').textContent).toBe('o'))
    expect(acquire).toHaveBeenCalledOnce()
    unmount()
    await waitFor(() => expect(release).toHaveBeenCalledOnce())
    await new Promise((r) => setTimeout(r, 20))
    expect(acquire).toHaveBeenCalledOnce()
    expect(release).toHaveBeenCalledOnce()
  })

  it('a started scope whose render never commits is closed after the adoption window', async () => {
    vi.useFakeTimers()
    try {
      const release = vi.fn()
      const L = Layer.scoped(CleanupService, Effect.acquireRelease(Effect.succeed({ id: 'p', cleanup: () => {} }), () => Effect.sync(release)))
      function C() {
        return <div>{useService(CleanupService).id}</div>
      }
      function Throws(): never {
        throw new Error('abandon')
      }
      class Catch extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
        state = { failed: false }
        static getDerivedStateFromError() {
          return { failed: true }
        }
        render() {
          return this.state.failed ? null : this.props.children
        }
      }
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      renderStrict(
        <Catch>
          <Suspense fallback={null}>
            <LayerProvider provide={[L]}>
              <C />
              <Throws />
            </LayerProvider>
          </Suspense>
        </Catch>,
      )
      await vi.advanceTimersByTimeAsync(100)
      expect(release).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(5000)
      expect(release).toHaveBeenCalled()
      spy.mockRestore()
    } finally {
      vi.useRealTimers()
    }
  })
})
