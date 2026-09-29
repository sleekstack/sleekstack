import { describe, expect, it } from 'vitest'
import { walkProvide } from '@sleekstack/core'
import { layer, module, tag } from '../index'
import { unwrap, validateProvide, type Module } from '../module'
import { boot } from './helpers'
import { normalize } from '../errors'

const A = tag<string>('A')
const B = tag<string>('B')
const a = layer(A, () => 'a')

describe('module', () => {
  it('private Layers when exports is given; thunk imports work', async () => {
    const Lib = module({ name: 'Lib', provide: [a, layer(B, () => 'b')], exports: [A] })
    const { get, scope } = await boot(module({ name: 'App', imports: () => [Lib] }))
    expect(get(A)).toBe('a')
    expect(scope.context.unsafeMap.has('B')).toBe(false)
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
    expect(keys(App)).toEqual(['X', 'Y', 'Z'])
  })

  it('two direct same-key providers -> DuplicateTag', () => {
    const x1 = layer(tag<string>('Dup'), () => '1')
    const x2 = layer(tag<string>('Dup'), () => '2')
    expect(() => validateProvide([x1, x2])).toThrow(expect.objectContaining({ code: 'DuplicateTag' }))
  })

  it('a cyclic module set passes definition-time validation and fails at invocation', async () => {
    const box: { b?: Module } = {}
    const P = module({ name: 'P', provide: [layer(X, () => 'x')], imports: () => [box.b!] })
    box.b = module({ name: 'Q', imports: [P] })
    expect(() => validateProvide([P])).not.toThrow()
    expect(keys(P)).toEqual(['X'])
    expect(await boot(P).catch((e: unknown) => e)).toMatchObject({ code: 'ModuleCycle' })
  })
})

it('validateProvide tolerates a lazy import assigned after definition', async () => {
  const box: { m?: Module } = {}
  const App = module({ name: 'Lazy', imports: () => [box.m!] })
  expect(() => validateProvide([App])).not.toThrow()
  box.m = module({ name: 'Later', provide: [layer(tag<string>('L'), () => 'l')] })
  expect((await boot(App)).get(tag<string>('L'))).toBe('l')
})
