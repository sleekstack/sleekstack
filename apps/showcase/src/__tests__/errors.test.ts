/**
 * apps/showcase/src/__tests__/errors.test.ts
 *
 * R3, R11: every one of the 8 error-gallery cases throws its expected tag or
 * message. Each case is awaited on its own, isolated from the others.
 */
import { describe, expect, it } from 'vitest'
import { errorCases, runCase } from '../errors/cases.server'

const expected: Record<string, { readonly tag?: string; readonly messageContains: string }> = {
  'missing-dependency': { tag: 'MissingDependency', messageContains: 'requires "errors.MissingDependency.dep"' },
  'dependency-cycle': { tag: 'DependencyCycle', messageContains: 'Dependency cycle' },
  'captive-dependency': { tag: 'CaptiveDependency', messageContains: 'cannot depend on' },
  'ambiguous-provider': { tag: 'AmbiguousProvider', messageContains: 'same precedence' },
  'module-cycle': { tag: 'ModuleCycle', messageContains: 'Module import cycle' },
  'duplicate-module': { tag: 'DuplicateModule', messageContains: 'distinct modules are named' },
  'invalid-module': { tag: 'InvalidModule', messageContains: 'imports a non-module value' },
  'raw-layer-failure': { tag: 'RawLayerFailure', messageContains: 'Raw Layer in module "errors.RawLayerFailure.Boom" failed to build' },
}

describe('error gallery cases', () => {
  it('covers exactly the 8 documented cases', () => {
    expect(errorCases.map((c) => c.id).sort()).toEqual(Object.keys(expected).sort())
  })

  for (const errorCase of errorCases) {
    it(`${errorCase.id} throws its expected tag/message`, async () => {
      const result = await runCase(errorCase)
      const want = expected[errorCase.id]!
      expect(errorCase.expectedTag).toBe(want.tag)
      expect(result.tag).toBe(want.tag)
      expect(result.message).toContain(want.messageContains)
    })
  }

  it('a case producing a different tag than it declares is classified UNEXPECTED', async () => {
    const graphCase = errorCases.find((c) => c.id === 'missing-dependency')!
    const rawCase = errorCases.find((c) => c.id === 'raw-layer-failure')!
    for (const c of [graphCase, rawCase]) {
      const result = await runCase({ ...c, expectedTag: 'SomethingElse' })
      expect(result.tag).toBe('UNEXPECTED')
      expect(result.message).toContain(`got ${c.expectedTag}`)
    }
    const rejecting = await runCase({ ...rawCase, run: () => Promise.reject(new Error('runner blew up')) })
    expect(rejecting).toEqual({ tag: 'UNEXPECTED', message: 'runner blew up' })
  })
})
