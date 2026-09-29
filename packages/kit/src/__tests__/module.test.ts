import { describe, expect, it } from 'vitest'
import { AmbiguousProvider, buildGraph, snapshot as coreSnapshot, walkProvide } from '@sleekstack/core'
import { layer, module, snapshot, tag } from '../index'
import { unwrap, validateProvide, type Module } from '../module'
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

describe('validateProvide over core walkProvide', () => {
  const X = tag<string>('X')
  const Y = tag<string>('Y')
  const Z = tag<string>('Z')
  const keys = (m: Module) => {
    const out = new Set<string>()
    walkProvide(unwrap([m]), (t) => out.add(t.key))
    return [...out].sort()
  }

  it('shared fixture (nested imports, thunks, diamond): kit and core reach the same Tags', () => {
    const D = module({ name: 'D', provide: [layer(X, () => 'x')], exports: [X] })
    const L = module({ name: 'L', provide: [layer(Y, (x) => x, [X])], imports: [D] })
    const R = module({ name: 'R', imports: () => [D] })
    const App = module({ name: 'App', provide: [layer(Z, (y) => y, [Y])], imports: [L, R] })
    const s = coreSnapshot(buildGraph(unwrap([App])))
    const core = [...new Set([...s.nodes.flatMap((n) => n.provides), ...s.edges.map((e) => e.tag)])].sort()
    expect(keys(App)).toEqual(['X', 'Y', 'Z'])
    expect(core).toEqual(keys(App))
  })

  it('DuplicateTag wins over AmbiguousProvider for two direct same-key providers', () => {
    const x1 = layer(tag<string>('Dup'), () => '1')
    const x2 = layer(tag<string>('Dup'), () => '2')
    expect(() => validateProvide([x1, x2])).toThrow(expect.objectContaining({ code: 'DuplicateTag' }))
    expect(() => buildGraph(unwrap([x1, x2]))).toThrow(AmbiguousProvider)
  })

  it('a cyclic module set passes definition-time validation and fails at invocation', () => {
    const box: { b?: Module } = {}
    const P = module({ name: 'P', provide: [layer(X, () => 'x')], imports: () => [box.b!] })
    box.b = module({ name: 'Q', imports: [P] })
    expect(() => validateProvide([P])).not.toThrow()
    expect(keys(P)).toEqual(['X'])
    expect(() => snapshot(P)).toThrow(expect.objectContaining({ code: 'ModuleCycle' }))
  })
})

it('validateProvide tolerates a lazy import assigned after definition', () => {
  const box: { m?: Module } = {}
  const App = module({ name: 'Lazy', imports: () => [box.m!] })
  expect(() => validateProvide([App])).not.toThrow()
  box.m = module({ name: 'Later', provide: [layer(tag<string>('L'), () => 'l')] })
  expect(() => buildGraph(unwrap([App]))).not.toThrow()
})
