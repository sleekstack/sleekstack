import { Atom, makeAtomStore, MissingDependency } from '@sleekstack/core'
import { Context, Data, Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { el, Provider, renderToString, Store, useAtom, useAtomValue } from '../index'
import { jsx as rawJsx } from '../jsx-runtime'

// `jsx` as compiled JSX calls it: component types are checked by `sleekstack check`, not tsc.
const jsx = (type: any, props: any) => rawJsx(type, props)

const count = Atom.make(3)
class Greeting extends Context.Tag('Greeting')<Greeting, string>() {}
class Boom extends Data.TaggedError('Boom')<{}> {}

const Counter = () => Effect.map(useAtomValue(count), (n) => el('b', {}, String(n)))

describe('reactive components', () => {
  it('renders the current atom value with no wrapper element', async () => {
    expect(await renderToString(jsx(Counter, {}), { layer: Layer.empty })).toBe('<b>3</b>')
  })

  it('returns a Reactive node only when atoms were read', async () => {
    const node = await Effect.runPromise(Effect.provideService(jsx(Counter, {}), Store, makeAtomStore()))
    expect(node._tag).toBe('Reactive')
    const plain = await Effect.runPromise(jsx(() => Effect.succeed(el('p')), {}))
    expect(plain).toEqual(el('p'))
  })

  it('rejects a first-render failure with the original tagged error', async () => {
    const boom = new Boom()
    const Failing = () => Effect.flatMap(useAtomValue(count), () => Effect.fail(boom))
    await expect(renderToString(jsx(Failing, {}), { layer: Layer.empty })).rejects.toBe(boom)
  })

  it('sees an enclosing Provider layer', async () => {
    const Hi = () => Effect.zipWith(Greeting, useAtom(count), (g, [n]) => el('p', {}, `${g} ${n}`))
    const app = jsx(Provider, { layer: Layer.succeed(Greeting, 'hi'), children: jsx(Hi, {}) })
    expect(await renderToString(app, { layer: Layer.empty })).toBe('<p>hi 3</p>')
  })

  it('fails with a tagged error naming Store without a store; untracked on a direct call', async () => {
    const err = await Effect.runPromise(Effect.flip(useAtomValue(count) as unknown as Effect.Effect<number, unknown>))
    expect(err).toBeInstanceOf(MissingDependency)
    expect((err as MissingDependency).missing).toBe('Store')
    expect(await renderToString(Counter(), { layer: Layer.empty })).toBe('<b>3</b>')
  })

  it('rejects a user-built sleek-reactive element', async () => {
    await expect(renderToString(Effect.succeed(el('sleek-reactive')), { layer: Layer.empty })).rejects.toThrow(TypeError)
  })
})
