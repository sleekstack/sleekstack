/**
 * packages/core/src/__tests__/module.test.ts
 *
 * Failing test stubs for CORE-01 and CORE-04.
 * These tests are RED — the module() function does not exist yet.
 * Later plans turn them green.
 */
import { describe, it, expect } from 'vitest'
import { module } from '../index'

describe('module() — CORE-01: accepts name, layers, imports?, exports? and returns a typed Module', () => {
  it('[CORE-01] returns a Module whose _name equals the provided name', () => {
    const m = module({ name: 'TestModule', layers: [] })
    expect(m._name).toBe('TestModule')
  })

  it('[CORE-01] returns a Module whose _layers array reflects the provided layers', () => {
    const fakeLayer = {} as any
    const m = module({ name: 'LayerTest', layers: [fakeLayer] })
    expect(m._layers).toHaveLength(1)
    expect(m._layers[0]).toBe(fakeLayer)
  })

  it('[CORE-01] returns a Module whose _imports array defaults to empty when omitted', () => {
    const m = module({ name: 'NoImports', layers: [] })
    expect(Array.isArray(m._imports)).toBe(true)
    expect(m._imports).toHaveLength(0)
  })

  it('[CORE-01] returns a Module whose _imports array reflects provided imports', () => {
    const dep = module({ name: 'DepModule', layers: [] })
    const m = module({ name: 'ChildModule', layers: [], imports: [dep] })
    expect(m._imports).toHaveLength(1)
    expect(m._imports[0]._name).toBe('DepModule')
  })

  it('[CORE-01] returns a Module whose _exports array defaults to empty when exports omitted', () => {
    const m = module({ name: 'NoExports', layers: [] })
    expect(Array.isArray(m._exports)).toBe(true)
    expect(m._exports).toHaveLength(0)
  })
})

describe('module() — CORE-04: exports array surfaces only the declared exported Tags', () => {
  it('[CORE-04] a module with a single export has _exports containing exactly that Tag', () => {
    // Context.GenericTag is not available yet — use a plain symbol as stand-in for Tag identity
    const FakeTag = { _tag: 'FakeService' } as any
    const m = module({ name: 'ExportedModule', layers: [], exports: [FakeTag] })
    expect(m._exports).toHaveLength(1)
    expect(m._exports[0]).toBe(FakeTag)
  })

  it('[CORE-04] a module with no exports declaration has an empty _exports array (no Tags surfaced)', () => {
    const m = module({ name: 'PrivateModule', layers: [] })
    expect(m._exports).toHaveLength(0)
  })

  it('[CORE-04] a module with multiple exports surfaces all of them in _exports', () => {
    const TagA = { _tag: 'ServiceA' } as any
    const TagB = { _tag: 'ServiceB' } as any
    const m = module({ name: 'MultiExportModule', layers: [], exports: [TagA, TagB] })
    expect(m._exports).toHaveLength(2)
    expect(m._exports).toContain(TagA)
    expect(m._exports).toContain(TagB)
  })
})
