import { Context, Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { buildGraph, module, service, walkProvide, ModuleCycle, type Module } from '../index'

class A extends Context.Tag('A')<A, string>() {}
class B extends Context.Tag('B')<B, string>() {}
class C extends Context.Tag('C')<C, string>() {}
const svc = (t: typeof A | typeof B | typeof C, ...requires: (typeof A)[]) => service(t as typeof A, { requires }, () => Effect.succeed('x') as never)

const reached = (input: readonly Module[]) => {
  const out: string[] = []
  walkProvide(input, (t, m) => out.push(`${t.key}@${m?.name}`))
  return out
}

describe('walkProvide', () => {
  it('nested imports, thunks and diamonds: each module visited once', () => {
    const D = module({ name: 'D', entries: [svc(A)], exports: [A] })
    const L = module({ name: 'L', entries: [svc(B, A)], imports: [D] })
    const R = module({ name: 'R', imports: () => [D] })
    const App = module({ name: 'App', entries: [svc(C, B as never)], imports: [L, R] })
    expect(reached([App])).toEqual(['C@App', 'B@App', 'B@L', 'A@L', 'A@D', 'A@D'])
  })

  it('cycles are skipped, not thrown (buildGraph still throws ModuleCycle)', () => {
    const box: { b?: Module } = {}
    const X = module({ name: 'X', entries: [svc(A)], imports: () => [box.b!] })
    box.b = module({ name: 'Y', imports: [X] })
    expect(reached([X])).toEqual(['A@X'])
    expect(() => buildGraph([X])).toThrow(ModuleCycle)
  })
})
