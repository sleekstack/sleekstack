import { describe, expect, it } from 'vitest'
import { layer, module, tag } from '../index'
import { validateProvide, type Module } from '../module'
import { boot } from './helpers'

const A = tag<string>('A')
const B = tag<string>('B')
const a = layer(A, () => 'a')

describe('module', () => {
  it('thunk imports work', async () => {
    const Lib = module({ name: 'Lib', provide: [a, layer(B, () => 'b')], exports: [A] })
    const { get, scope } = await boot(module({ name: 'App', imports: () => [Lib] }))
    expect(get(A)).toBe('a')
    expect((await boot(module({ name: 'App', imports: [Lib] }))).get(A)).toBe('a')
  })

  it('provide order does not matter for array deps', async () => {
    const dep = layer(B, (x) => `b${x}`, [A])
    expect((await boot(module({ name: 'App', provide: [dep, a] }))).get(B)).toBe('ba')
    const { get } = await boot(
      module({
        name: 'App',
        provide: [layer(B, (x) => `b${x}`, [A])],
        imports: [module({ name: 'Lib', provide: [a] })],
      }),
    )
    expect(get(B)).toBe('ba')
  })
})

describe('validateProvide', () => {
  const X = tag<string>('X')
  const Y = tag<string>('Y')
  const Z = tag<string>('Z')
  it('nested imports, thunks and a diamond are walked: a distinct Tag with a used key is DuplicateTag', () => {
    const D = module({ name: 'D', provide: [layer(X, () => 'x')], exports: [X] })
    const L = module({ name: 'L', provide: [layer(Y, (x) => x, [X])], imports: [D] })
    const R = module({ name: 'R', imports: () => [D] })
    const App = module({ name: 'App', provide: [layer(Z, (y) => y, [Y])], imports: [L, R] })
    expect(() => validateProvide([App])).not.toThrow()
    const Other = module({ name: 'Other', provide: [layer(tag<string>('Z'), () => 'z')] })
    expect(() => validateProvide([App, Other])).toThrow(expect.objectContaining({ code: 'DuplicateTag' }))
  })

  it('two direct same-key providers -> DuplicateTag', () => {
    const x1 = layer(tag<string>('Dup'), () => '1')
    const x2 = layer(tag<string>('Dup'), () => '2')
    expect(() => validateProvide([x1, x2])).toThrow(expect.objectContaining({ code: 'DuplicateTag' }))
  })

  it('a cyclic module set passes validation (the analyzer reports the cycle)', () => {
    const box: { b?: Module } = {}
    const P = module({ name: 'P', provide: [layer(X, () => 'x')], imports: () => [box.b!] })
    box.b = module({ name: 'Q', imports: [P] })
    expect(() => validateProvide([P])).not.toThrow()
  })
})

it('validateProvide tolerates a lazy import assigned after definition', async () => {
  const box: { m?: Module } = {}
  const App = module({ name: 'Lazy', imports: () => [box.m!] })
  expect(() => validateProvide([App])).not.toThrow()
  box.m = module({ name: 'Later', provide: [layer(tag<string>('L'), () => 'l')] })
  expect((await boot(App)).get(tag<string>('L'))).toBe('l')
})
