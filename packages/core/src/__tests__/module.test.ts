import { describe, expect, it } from 'vitest'
import { Context, Effect, Layer } from 'effect'
import { declareLayer, InvalidModule, module } from '../index'
import { service } from './helpers'

class T extends Context.Tag('T')<T, number>() {}
const TDef = service(T, {}, () => Effect.succeed(1))

describe('module()', () => {
  it.each([undefined, '', '   ', 42])('throws InvalidModule synchronously for name %j', (name) => {
    expect(() => module({ name: name as any })).toThrow(InvalidModule)
  })

  it.each([
    [{}, /entry 0 is not/],
    [{ _tag: 'ServiceDefinition' }, /entry 0 is not a declared Layer or Layer/],
    [{ _tag: 'DeclaredLayer', layer: {} }, /entry 0 is a malformed declared Layer/],
  ])('rejects malformed entry %j with InvalidModule', (entry, msg) => {
    expect(() => module({ name: 'M', entries: [entry as any] })).toThrow(msg)
  })

  it('keeps entries, imports, exports, lifetime', () => {
    const dep = module({ name: 'Dep' })
    const raw = Layer.succeed(T, 2)
    const decl = declareLayer(raw)
    const m = module({ name: 'M', entries: [TDef, decl, raw], imports: [dep], exports: [T], lifetime: 'request' })
    expect(m).toMatchObject({
      name: 'M',
      entries: [TDef, decl, raw],
      imports: [dep],
      exports: [T],
      lifetime: 'request',
    })
    expect(module({ name: 'Empty' })).toMatchObject({ entries: [], imports: [] })
  })
})
