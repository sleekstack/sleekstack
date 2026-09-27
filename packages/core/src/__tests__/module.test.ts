import { describe, expect, it } from 'vitest'
import { Context, Effect, Layer } from 'effect'
import { declareLayer, InvalidModule, module, service } from '../index'

class T extends Context.Tag('T')<T, number>() {}
const TDef = service(T, {}, () => Effect.succeed(1))

describe('module()', () => {
  it.each([undefined, '', '   ', 42])('throws InvalidModule synchronously for name %j', (name) => {
    expect(() => module({ name: name as any })).toThrow(InvalidModule)
  })

  it('rejects entries that are not definitions or Layers', () => {
    expect(() => module({ name: 'M', entries: [{} as any] })).toThrow(/entry 0/)
  })

  it('keeps entries, imports, exports, lifetime', () => {
    const dep = module({ name: 'Dep' })
    const raw = Layer.succeed(T, 2)
    const decl = declareLayer(raw, { provides: [T] })
    const m = module({ name: 'M', entries: [TDef, decl, raw], imports: [dep], exports: [T], lifetime: 'request' })
    expect(m).toMatchObject({ name: 'M', entries: [TDef, decl, raw], imports: [dep], exports: [T], lifetime: 'request' })
    expect(module({ name: 'Empty' })).toMatchObject({ entries: [], imports: [], exports: [] })
  })
})
