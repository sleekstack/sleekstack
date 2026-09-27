import { describe, expect, it } from 'vitest'
import { buildGraph, module, DuplicateModule, ModuleCycle } from '../index'

const err = (f: () => unknown) => { try { f() } catch (e) { return e } throw new Error('did not throw') }

describe('buildGraph: module import graph (identity)', () => {
  it('identity cycle through thunk imports -> ModuleCycle with full path', () => {
    const A = module({ name: 'A', imports: () => [B] })
    const B = module({ name: 'B', imports: () => [C] })
    const C = module({ name: 'C', imports: () => [A] })
    const e = err(() => buildGraph([A]))
    expect(e).toBeInstanceOf(ModuleCycle)
    expect((e as ModuleCycle).path).toEqual(['A', 'B', 'C', 'A'])
    expect((e as ModuleCycle).message).toBe('Module import cycle: A -> B -> C -> A')
  })

  it('distinct modules sharing a name -> DuplicateModule', () => {
    expect(err(() => buildGraph([module({ name: 'X' }), module({ name: 'X' })]))).toBeInstanceOf(DuplicateModule)
  })

  it('A(new) -> B -> A(old) is DuplicateModule, not a cycle', () => {
    const oldA = module({ name: 'A' })
    const B = module({ name: 'B', imports: [oldA] })
    const newA = module({ name: 'A', imports: [B] })
    expect(err(() => buildGraph([newA]))).toBeInstanceOf(DuplicateModule)
  })

  it('linear chains and diamonds are not errors', () => {
    const D = module({ name: 'D' })
    const B = module({ name: 'B', imports: [D] })
    const C = module({ name: 'C', imports: [D] })
    expect(() => buildGraph([module({ name: 'A', imports: [B, C] })])).not.toThrow()
  })
})
