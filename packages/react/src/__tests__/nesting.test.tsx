/**
 * packages/react/src/__tests__/nesting.test.tsx
 *
 * Failing test stubs for REACT-02, REACT-05, CORE-03.
 * These tests are RED — the new LayerProvider nesting/shadowing logic does not exist yet.
 * Later plans turn them green.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React, { Suspense } from 'react'
import { Context, Layer, Effect } from 'effect'
import { LayerProvider } from '../index'
import { useService } from '../index'
import { module } from '@sleekstack/core'

// --- Test service setup ---

interface DatabaseServiceInterface {
  query(): string
}

const DatabaseService = Context.GenericTag<DatabaseServiceInterface>('DatabaseService')
const RealDatabaseLayer = Layer.succeed(DatabaseService, { query: () => 'real-db-result' })
const MockDatabaseLayer = Layer.succeed(DatabaseService, { query: () => 'mock-db-result' })

interface UserServiceInterface {
  getUser(): string
}

const UserService = Context.GenericTag<UserServiceInterface>('UserService')
const UserLayer = Layer.succeed(UserService, { getUser: () => 'test-user' })

interface FinalizeOrderInterface {
  order: string[]
}

// --- REACT-02 Tests ---

describe('Nested LayerProvider — REACT-02: inherits parent scope, inner finalizes first', () => {
  it('[REACT-02] a nested LayerProvider can resolve a service provided only by the parent', async () => {
    function InnerConsumer() {
      const db = useService(DatabaseService)
      return <div data-testid="db-result">{db.query()}</div>
    }

    render(
      <LayerProvider provide={[RealDatabaseLayer]}>
        <Suspense fallback={<div>loading outer</div>}>
          {/* Inner provider does not provide DatabaseService — should inherit from parent */}
          <LayerProvider provide={[UserLayer]}>
            <Suspense fallback={<div>loading inner</div>}>
              <InnerConsumer />
            </Suspense>
          </LayerProvider>
        </Suspense>
      </LayerProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('db-result').textContent).toBe('real-db-result')
    })
  })

  it('[REACT-02] inner LayerProvider unmount finalizer runs before outer when both unmount', async () => {
    const unmountOrder: string[] = []

    const OuterScopedLayer = Layer.scoped(
      DatabaseService,
      Effect.acquireRelease(
        Effect.sync(() => ({ query: () => 'outer-db' })),
        () => Effect.sync(() => unmountOrder.push('outer'))
      )
    )

    const InnerScopedLayer = Layer.scoped(
      UserService,
      Effect.acquireRelease(
        Effect.sync(() => ({ getUser: () => 'inner-user' })),
        () => Effect.sync(() => unmountOrder.push('inner'))
      )
    )

    function InnerConsumer() {
      const user = useService(UserService)
      return <div data-testid="user">{user.getUser()}</div>
    }

    const { unmount } = render(
      <LayerProvider provide={[OuterScopedLayer]}>
        <Suspense fallback={<div>loading</div>}>
          <LayerProvider provide={[InnerScopedLayer]}>
            <Suspense fallback={<div>loading inner</div>}>
              <InnerConsumer />
            </Suspense>
          </LayerProvider>
        </Suspense>
      </LayerProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('inner-user')
    })

    unmount()

    await waitFor(() => {
      expect(unmountOrder.length).toBeGreaterThanOrEqual(1)
    })

    // Inner should finalize before outer
    const innerIdx = unmountOrder.indexOf('inner')
    const outerIdx = unmountOrder.indexOf('outer')
    expect(innerIdx).toBeLessThan(outerIdx)
  })
})

// --- REACT-05 Tests ---

describe('LayerProvider shadowing — REACT-05: replacement Layer shadows transitive dependency from imports', () => {
  it('[REACT-05] an inner LayerProvider can shadow a service from a parent via provide ordering', async () => {
    function DbConsumer() {
      const db = useService(DatabaseService)
      return <div data-testid="db">{db.query()}</div>
    }

    render(
      <LayerProvider provide={[RealDatabaseLayer]}>
        <Suspense fallback={<div>loading</div>}>
          {/* Inner provider shadows DatabaseService with a mock */}
          <LayerProvider provide={[MockDatabaseLayer]}>
            <Suspense fallback={<div>loading inner</div>}>
              <DbConsumer />
            </Suspense>
          </LayerProvider>
        </Suspense>
      </LayerProvider>
    )

    await waitFor(() => {
      // Inner provider's MockDatabaseLayer should win over parent's RealDatabaseLayer
      expect(screen.getByTestId('db').textContent).toBe('mock-db-result')
    })
  })

  it('[REACT-05] a module in the parent provide array has its deps shadowed by inner provide replacement', async () => {
    const CoreModule = module({
      name: 'CoreModule',
      layers: [RealDatabaseLayer],
    })

    function DbConsumer() {
      const db = useService(DatabaseService)
      return <div data-testid="shadowed-db">{db.query()}</div>
    }

    render(
      <LayerProvider provide={[CoreModule]}>
        <Suspense fallback={<div>loading</div>}>
          {/* Inner provider replaces the DatabaseService from CoreModule with a mock */}
          <LayerProvider provide={[MockDatabaseLayer]}>
            <Suspense fallback={<div>loading inner</div>}>
              <DbConsumer />
            </Suspense>
          </LayerProvider>
        </Suspense>
      </LayerProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('shadowed-db').textContent).toBe('mock-db-result')
    })
  })
})

// --- CORE-03 Tests ---

describe('module() imports in LayerProvider — CORE-03: Module imports are automatically pulled into scope', () => {
  it('[CORE-03] a Module passed to LayerProvider provide pulls its imports into scope automatically', async () => {
    // ChildModule imports DatabaseModule — consumer should get DatabaseService without explicitly declaring it
    const DatabaseModule = module({
      name: 'DatabaseModule',
      layers: [RealDatabaseLayer],
      exports: [DatabaseService],
    })

    const AppModule = module({
      name: 'AppModule',
      layers: [UserLayer],
      imports: [DatabaseModule],
    })

    function DbConsumerFromImport() {
      // DatabaseService comes from DatabaseModule which is imported by AppModule
      // No explicit DatabaseLayer in this LayerProvider's provide array
      const db = useService(DatabaseService)
      return <div data-testid="imported-db">{db.query()}</div>
    }

    render(
      // Only AppModule in provide — DatabaseModule is an import, should be auto-pulled
      <LayerProvider provide={[AppModule]}>
        <Suspense fallback={<div>loading</div>}>
          <DbConsumerFromImport />
        </Suspense>
      </LayerProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('imported-db').textContent).toBe('real-db-result')
    })
  })

  it('[CORE-03] a deeply imported Module (transitive import) is also pulled into scope', async () => {
    const DatabaseModule = module({
      name: 'DatabaseModule2',
      layers: [RealDatabaseLayer],
      exports: [DatabaseService],
    })

    const UserModule = module({
      name: 'UserModule2',
      layers: [UserLayer],
      imports: [DatabaseModule],
    })

    const AppModule = module({
      name: 'AppModule2',
      layers: [],
      imports: [UserModule], // Transitively imports DatabaseModule
    })

    function TransitiveConsumer() {
      const db = useService(DatabaseService)
      return <div data-testid="transitive-db">{db.query()}</div>
    }

    render(
      <LayerProvider provide={[AppModule]}>
        <Suspense fallback={<div>loading</div>}>
          <TransitiveConsumer />
        </Suspense>
      </LayerProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('transitive-db').textContent).toBe('real-db-result')
    })
  })
})
