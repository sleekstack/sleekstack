/**
 * packages/react/src/__tests__/layerProvider.external.test.tsx
 *
 * R5: a top-level LayerProvider given an externally owned `appScope` shares it and never closes it.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React, { Suspense } from 'react'
import { Context, Effect, Layer } from 'effect'
import { makeAppScope } from '@sleekstack/core'
import { LayerProvider, useService } from '../index'

const Counter = Context.GenericTag<{ readonly id: number }>('ExternalCounter')

describe('LayerProvider appScope (external)', () => {
  it('two roots share the app-lifetime instance; unmounting never closes the external scope', async () => {
    let built = 0
    let finalized = 0
    const CounterLayer = Layer.scoped(
      Counter,
      Effect.acquireRelease(Effect.sync(() => ({ id: ++built })), () => Effect.sync(() => void finalized++)),
    )
    const app = await Effect.runPromise(makeAppScope([CounterLayer]))

    const Show = ({ testId }: { testId: string }) => <div data-testid={testId}>{useService(Counter).id}</div>
    const tree = (testId: string) => (
      <LayerProvider provide={[]} appScope={app}>
        <Suspense fallback={null}><Show testId={testId} /></Suspense>
      </LayerProvider>
    )
    const a = render(tree('a'))
    const b = render(tree('b'))
    await waitFor(() => {
      expect(screen.getByTestId('a').textContent).toBe('1')
      expect(screen.getByTestId('b').textContent).toBe('1')
    })

    a.unmount()
    b.unmount()
    await new Promise((r) => setTimeout(r, 20))
    expect(finalized).toBe(0)

    await Effect.runPromise(app.close)
    expect(finalized).toBe(1)
    expect(built).toBe(1)
  })
})
