/**
 * packages/core/src/__tests__/cycle.test.ts
 *
 * Failing test stubs for CORE-02.
 * These tests are RED — the module() cycle detection does not exist yet.
 * Later plans turn them green.
 */
import { describe, it, expect } from 'vitest'
import { module } from '../index'

describe('module() — CORE-02: detects circular imports at definition time and throws with cycle trace', () => {
  it('[CORE-02] throws synchronously when two modules import each other (AuthModule <-> UserModule)', () => {
    // Build a two-node cycle: Auth imports User, User imports Auth
    // Because module() detects cycles at call time, the second call should throw
    const authModuleRef: { current: ReturnType<typeof module> | null } = { current: null }

    const userModule = module({ name: 'UserModule', layers: [] })

    // Now create AuthModule that imports UserModule — no cycle yet
    const authModule = module({ name: 'AuthModule', layers: [], imports: [userModule] })
    authModuleRef.current = authModule

    // Attempt to create UserModule2 that imports authModule, completing the cycle
    expect(() => {
      module({ name: 'UserModule', layers: [], imports: [authModule] })
    }).toThrow()
  })

  it('[CORE-02] the thrown error message contains " -> " as the cycle separator', () => {
    const depA = module({ name: 'ModuleA', layers: [] })
    const depB = module({ name: 'ModuleB', layers: [], imports: [depA] })

    let errorMessage = ''
    try {
      // ModuleA importing ModuleB which imports ModuleA closes the cycle
      module({ name: 'ModuleA', layers: [], imports: [depB] })
    } catch (e) {
      errorMessage = (e as Error).message
    }

    expect(errorMessage).toContain(' -> ')
  })

  it('[CORE-02] the thrown error message names the modules in the cycle trace', () => {
    const cycleModuleA = module({ name: 'CycleModuleA', layers: [] })
    const cycleModuleB = module({ name: 'CycleModuleB', layers: [], imports: [cycleModuleA] })

    let errorMessage = ''
    try {
      module({ name: 'CycleModuleA', layers: [], imports: [cycleModuleB] })
    } catch (e) {
      errorMessage = (e as Error).message
    }

    expect(errorMessage).toContain('CycleModuleA')
    expect(errorMessage).toContain('CycleModuleB')
    expect(errorMessage).toContain(' -> ')
  })

  it('[CORE-02] does NOT throw for a linear dependency chain (A imports B imports C — no cycle)', () => {
    const modC = module({ name: 'LinearC', layers: [] })
    const modB = module({ name: 'LinearB', layers: [], imports: [modC] })
    expect(() => {
      module({ name: 'LinearA', layers: [], imports: [modB] })
    }).not.toThrow()
  })

  it('[CORE-02] does NOT throw for a diamond dependency (A imports B and C, both import D — no cycle)', () => {
    const modD = module({ name: 'DiamondD', layers: [] })
    const modB = module({ name: 'DiamondB', layers: [], imports: [modD] })
    const modC = module({ name: 'DiamondC', layers: [], imports: [modD] })
    expect(() => {
      module({ name: 'DiamondA', layers: [], imports: [modB, modC] })
    }).not.toThrow()
  })
})
