import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Atom } from '@sleekstack/core'
import { LayerProvider } from '@sleekstack/react'
import { SleekStackDevtools, DEVTOOLS_MARKER } from '../index'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('SleekStackDevtools', () => {
  it('renders an empty state when the handler is off', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Not Found', { status: 404 })))
    render(<SleekStackDevtools />)
    expect(await screen.findByText(/Devtools are off/)).not.toBeNull()
    expect(screen.getByText(/No atoms registered/)).not.toBeNull()
    expect(document.querySelector(`[data-devtools="${DEVTOOLS_MARKER}"]`)).not.toBeNull()
  })

  it('shows graph, live scopes, errors and read-only atoms', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      scopes: [],
      errors: [{ at: 1, kind: 'error', label: 'defect', detail: 'boom' }],
      live: { app: true, scopes: ['request#3'] },
      graph: { roots: [{ root: 'app', graph: { nodes: [{ id: 'a', name: 'Store', lifetime: 'app' }], edges: [] } }] },
    })))
    const count = Atom.make(7)
    render(
      <LayerProvider provide={[]}>
        <SleekStackDevtools atoms={{ count }} />
      </LayerProvider>,
    )
    expect(await screen.findByText(/1 nodes, 0 edges/)).not.toBeNull()
    expect(screen.getByText('request#3')).not.toBeNull()
    expect(screen.getByText('boom')).not.toBeNull()
    expect(await screen.findByText('7')).not.toBeNull()
  })
})
