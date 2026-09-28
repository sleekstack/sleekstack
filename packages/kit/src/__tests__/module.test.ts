import { describe, expect, it } from 'vitest'
import { buildGraph, snapshot as coreSnapshot } from '@sleekstack/core'
import { layer, module, snapshot, tag } from '../index'
import { unwrap, type Module } from '../module'
import { boot } from './helpers'
import { normalize } from '../errors'

const A = tag<string>('A')
const B = tag<string>('B')
const a = layer(A, () => 'a')

describe('module + snapshot', () => {
  it('snapshot(App) deep-equals core snapshot of the same graph', () => {
    const Lib = module({ name: 'Lib', provide: [a], exports: [A] })
    const App = module({ name: 'App', provide: [layer(B, (x) => x + 'b', [A])], imports: [Lib] })
    expect(snapshot(App)).toEqual(coreSnapshot(buildGraph(unwrap([App]))))
    expect(snapshot(App).nodes.map((n) => n.id).sort()).toEqual(['A', 'B'])
  })

  it('private Layers when exports is given; thunk imports work', async () => {
    const Lib = module({ name: 'Lib', provide: [a, layer(B, () => 'b')], exports: [A] })
    const s = snapshot(module({ name: 'App', imports: () => [Lib] }))
    expect(s.nodes.find((n) => n.id === 'B')?.private).toBe(true)
    expect((await boot(module({ name: 'App', imports: [Lib] }))).get(A)).toBe('a')
  })
})

describe('module privacy', () => {
  it('requiring a private Tag from outside -> SleekStackError PrivateDependency', async () => {
    const Lib = module({ name: 'Lib', provide: [a, layer(B, () => 'b')], exports: [A] })
    const C = tag<string>('C')
    const App = module({ name: 'App', provide: [layer(C, (b) => b, [B])], imports: [Lib] })
    expect(normalize(await boot(App).catch((e: unknown) => e))).toMatchObject({ name: 'SleekStackError', code: 'PrivateDependency', details: { tag: 'B', module: 'Lib' } })
  })
})
