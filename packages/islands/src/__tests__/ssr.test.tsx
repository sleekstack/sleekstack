// @vitest-environment node
// Own file: the server branch runs only where `window` is undefined (node environment).
import { prerender } from 'react-dom/static'
import { describe, expect, it } from 'vitest'
import { layer, tag, withCleanup } from '@sleekstack/kit'
import { useService } from '@sleekstack/kit/react'
import { defineIslands } from '../index'

const App = tag<{ id: number }>('IslandsApp')
const Comp = tag<{ id: number }>('IslandsComp')
const Show = (_: { n?: number }) => <i>{`${useService(App).id}/${useService(Comp).id}`}</i>

describe('Island SSR', () => {
  it('server-renders an Island that calls useService', async () => {
    const Island = defineIslands({ show: async () => ({ default: Show }) }, { provide: [layer(App, { id: 7 })] })
    const { prelude } = await prerender(<Island name="show" props={{}} provide={[layer(Comp, { id: 8 })]} />)
    expect(await new Response(prelude).text()).toContain('7/8')
  })

  it('builds the server app scope once per registry, never per render (no finalizer leak)', async () => {
    let builds = 0
    let closes = 0
    const Island = defineIslands(
      { show: async () => ({ default: Show }) },
      { provide: [layer(App, () => withCleanup({ id: ++builds }, () => void closes++))] },
    )
    // Distinct props per render, so no render adopts another's parked scope.
    for (let i = 0; i < 3; i++) {
      const { prelude } = await prerender(<Island name="show" props={{ n: i }} provide={[layer(Comp, { id: 8 })]} />)
      expect(await new Response(prelude).text()).toContain('1/8')
    }
    expect(builds).toBe(1)
    expect(closes).toBe(0)
  })
})
