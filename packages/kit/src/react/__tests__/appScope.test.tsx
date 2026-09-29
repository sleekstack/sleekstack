// @vitest-environment jsdom
import { Suspense } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { layer, withCleanup } from '../../index'
import { tag } from '../../index'
import { LayerProvider, createAppScope, useService } from '../index'

const Id = tag<number>('KitExternalId')

describe('kit createAppScope + LayerProvider appScope', () => {
  it('roots share one instance; unmount never closes it; close() does', async () => {
    let n = 0
    const release = vi.fn()
    const app = await createAppScope([layer(Id, () => withCleanup(++n, release))])
    const Show = ({ id }: { id: string }) => <i data-testid={id}>{useService(Id)}</i>
    const root = (id: string) => render(<LayerProvider provide={[]} appScope={app}><Suspense fallback={null}><Show id={id} /></Suspense></LayerProvider>)
    const a = root('a'), b = root('b')
    await waitFor(() => expect([screen.getByTestId('a').textContent, screen.getByTestId('b').textContent]).toEqual(['1', '1']))
    a.unmount(); b.unmount()
    await new Promise((r) => setTimeout(r, 20))
    expect(release).not.toHaveBeenCalled()
    await app.close()
    expect(release).toHaveBeenCalledTimes(1)
  })
})
