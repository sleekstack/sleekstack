// @vitest-environment jsdom
import { Suspense } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { layer, withCleanup } from '../../index'
import { tag } from '../../index'
import { LayerProvider, createAppScope, useService } from '../index'

const Id = tag<number>('KitExternalId')
const Comp = tag<string>('KitExternalComp')

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

  it('close() right after the last unmount closes component scopes before the app scope', async () => {
    const order: string[] = []
    const app = await createAppScope([layer(Id, () => withCleanup(1, () => void order.push('app')))])
    const provide = [layer(Comp, () => withCleanup('c', () => void order.push('component')), [], { lifetime: 'component' })]
    const Show = () => <i data-testid="c">{useService(Comp)}</i>
    const r = render(<LayerProvider provide={provide} appScope={app}><Suspense fallback={null}><Show /></Suspense></LayerProvider>)
    await screen.findByText('c')
    r.unmount()
    await app.close()
    expect(order).toEqual(['component', 'app'])
  })
})
