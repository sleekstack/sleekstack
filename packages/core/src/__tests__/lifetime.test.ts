import { describe, expect, it } from 'vitest'
import { canDependOn } from '../index'

// The captive-dependency check itself is the analyzer's (packages/analyze fixtures `captive-dependency`, `ported`).
describe('lifetime matrix', () => {
  it.each([
    ['app', 'app', true], ['app', 'request', false], ['request', 'app', true], ['request', 'request', true],
    ['request', 'component', false], ['component', 'request', false], ['component', 'app', true], ['component', 'component', true],
  ] as const)('%s -> %s: %s', (from, to, ok) => expect(canDependOn(from, to)).toBe(ok))
})
