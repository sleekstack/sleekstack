/**
 * apps/showcase/src/__tests__/errors.test.ts
 *
 * R3, R11: every one of the 8 error-gallery cases throws its expected tag or
 * message. Each case is awaited on its own, isolated from the others.
 */
import { describe, expect, it } from 'vitest'
import { errorCases } from '../errors/cases.server'

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
      const result = await errorCase.run()
      const want = expected[errorCase.id]!
      if (want.tag) expect(result.tag).toBe(want.tag)
      expect(result.tag).not.toBe('UNEXPECTED')
      expect(result.message).toContain(want.messageContains)
    })
  }
})
