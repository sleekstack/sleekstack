import { describe, expect, it } from 'vitest'
import { Context, Effect, Layer } from 'effect'
import { buildGraph, CaptiveDependency, declareLayer, module, service } from '../index'

class A extends Context.Tag('A')<A, number>() {}
class R extends Context.Tag('R')<R, number>() {}
class C extends Context.Tag('C')<C, number>() {}

const one = Effect.succeed(1)
const captive = (f: () => unknown) => {
  try { f() } catch (e) { return e as CaptiveDependency }
  throw new Error('expected CaptiveDependency')
}

describe('lifetime matrix', () => {
  it.each([
    ['app -> request', service(A, { requires: [R] }, () => one), service(R, { lifetime: 'request' }, () => one), 'A', 'app', 'R', 'request'],
    ['request -> component', service(R, { requires: [C], lifetime: 'request' }, () => one), service(C, { lifetime: 'component' }, () => one), 'R', 'request', 'C', 'component'],
    ['component -> request', service(C, { requires: [R], lifetime: 'component' }, () => one), service(R, { lifetime: 'request' }, () => one), 'C', 'component', 'R', 'request'],
  ] as const)('rejects %s naming both services and lifetimes', (_, from, to, s, sl, d, dl) => {
    const e = captive(() => buildGraph([from, to]))
    expect(e._tag).toBe('CaptiveDependency')
    expect(e).toMatchObject({ service: s, lifetime: sl, dependency: d, dependencyLifetime: dl })
    expect(e.message).toContain(`"${s}" (${sl})`)
    expect(e.message).toContain(`"${d}" (${dl})`)
  })

  it('allows request/component -> app and same-lifetime edges', () => {
    const a = service(A, {}, () => one)
    expect(() => buildGraph([a, service(R, { requires: [A], lifetime: 'request' }, () => one)])).not.toThrow()
    expect(() => buildGraph([a, service(C, { requires: [A], lifetime: 'component' }, () => one)])).not.toThrow()
  })

  it('checks declared Layers (module lifetime applies)', () => {
    const req = module({ name: 'req', lifetime: 'request', entries: [declareLayer(Layer.succeed(R, 1), { provides: [R] })] })
    const e = captive(() => buildGraph([service(A, { requires: [R] }, () => one), req]))
    expect(e).toMatchObject({ service: 'A', dependency: 'R', dependencyLifetime: 'request' })
  })
})
