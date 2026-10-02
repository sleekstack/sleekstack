import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Atom } from '@sleekstack/core'
import { renderStrict } from './renderStrict'
import { LayerProvider, useAtomValue } from '../index'

const Reader = ({ atom }: { atom: Atom.Atom<number> }) => <span data-testid="v">{useAtomValue(atom)}</span>

describe('dev atom store registry', () => {
  it('lists a store mounted before the registry module loaded, and drops it on unmount (StrictMode)', async () => {
    const count = Atom.make(3)
    const view = renderStrict(<LayerProvider provide={[]}><Reader atom={count} /></LayerProvider>)
    expect((await screen.findByTestId('v')).textContent).toBe('3')
    const { atomStores } = await import('../registry') // late load
    const labels = () => atomStores().flatMap((s) => s.inspect().map((a) => a.label))
    expect(labels()).toEqual([count.label])
    expect(atomStores()[0]!.inspect()).toEqual([{ atom: count, label: count.label, value: 3 }])
    view.unmount()
    await waitFor(() => expect(atomStores()).toEqual([]))
  })

  it('a disposed store inspects as empty instead of throwing', async () => {
    const count = Atom.make(1)
    const view = render(<LayerProvider provide={[]}><Reader atom={count} /></LayerProvider>)
    await screen.findByTestId('v')
    const { atomStores } = await import('../registry')
    const [store] = atomStores()
    await store!.dispose()
    expect(store!.inspect()).toEqual([])
    view.unmount()
    await waitFor(() => expect(atomStores()).toEqual([]))
  })
})
