import { describe, expect, it } from 'vitest'
import { Context, Effect, Layer, Schema } from 'effect'
import { Atom } from '@sleekstack/core'
import { configureRuntime, prefetchAtoms } from '../index'

class Name extends Context.Tag('atoms-test/Name')<Name, string>() {}

describe('prefetchAtoms', () => {
  it('snapshots settled values, omits Failure, disposes the store; a run failure rejects and still disposes', async () => {
    configureRuntime({ layer: Layer.succeed(Name, 'ada') }, { replace: true })
    const released: string[] = []
    const greeting = Atom.serializable.result(
      Atom.make(Effect.gen(function* () {
        yield* Effect.addFinalizer(() => Effect.sync(() => released.push('greeting')))
        yield* Effect.sleep(5)
        return `hi ${yield* Name}`
      }).pipe(Effect.scoped)),
      { key: 'greeting', schema: Schema.String },
    )
    const count = Atom.serializable(Atom.make(3), { key: 'count', schema: Schema.Number })
    const broken = Atom.serializable.result(Atom.make(Effect.fail('nope')), { key: 'broken', schema: Schema.String })
    // Built inside the store: the finalizer registered by `keep` runs when the store is disposed.
    const keep = Atom.serializable(
      Atom.make((get) => { get.addFinalizer(() => released.push('store')); return 1 }),
      { key: 'keep', schema: Schema.Number },
    )

    const snapshot = await prefetchAtoms([greeting, count, broken, keep])
    expect(snapshot).toEqual({ greeting: 'hi ada', count: 3, keep: 1 })
    expect(Object.getPrototypeOf(snapshot)).toBe(Object.prototype)
    expect(released).toContain('store')

    released.length = 0
    const failingRequest = Layer.effect(Name, Effect.die(new Error('request down')))
    await expect(prefetchAtoms([keep], { request: failingRequest })).rejects.toThrow(/request down/)

    released.length = 0
    // A second atom under the same key throws DuplicateAtomKey after the store (and `keep`) are built.
    const clash = Atom.serializable(Atom.make(2), { key: 'keep', schema: Schema.Number })
    await expect(prefetchAtoms([keep, clash])).rejects.toThrow(/keep/)
    expect(released).toEqual(['store'])
  })

  it('accepts only serializable atoms (type test)', () => {
    const plain = Atom.make(1)
    // @ts-expect-error an unbranded atom is not Serializable
    void (() => prefetchAtoms([plain]))
    void (() => prefetchAtoms([Atom.serializable(plain, { key: 'k', schema: Schema.Number })]))
  })
})
