// @vitest-environment node
// Own file: a server render parks provider scopes that a same-process client provider could adopt.
import { prerender } from 'react-dom/static'
import { describe, expect, it } from 'vitest'
import { layer, tag } from '@sleekstack/kit'
import { useService } from '@sleekstack/kit/react'
import { defineIslands } from '../index'

const App = tag<{ id: number }>('IslandsApp')
const Comp = tag<{ id: number }>('IslandsComp')
const Show = () => <i>{`${useService(App).id}/${useService(Comp).id}`}</i>

describe('Island SSR', () => {
  it('server-renders an Island that calls useService', async () => {
    const Island = defineIslands({ show: async () => ({ default: Show }) }, { provide: [layer(App, { id: 7 })] })
    const { prelude } = await prerender(<Island name="show" props={{}} provide={[layer(Comp, { id: 8 })]} />)
    expect(await new Response(prelude).text()).toContain('7/8')
  })

})
