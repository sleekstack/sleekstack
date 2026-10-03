import { Context, Effect, Layer } from 'effect'
import { expectTypeOf } from 'vitest'
import { type Component, el, fromReact, type Node, Provide, renderToString } from '../index'

class A extends Context.Tag('A')<A, { readonly a: string }>() {}
class B extends Context.Tag('B')<B, { readonly b: string }>() {}
class C extends Context.Tag('C')<C, { readonly c: string }>() {}

const layerA = Layer.succeed(A, { a: 'a' })
const layerB = Layer.succeed(B, { b: 'b' })
const layerAB = Layer.merge(layerA, layerB)
const layerABC = Layer.mergeAll(layerA, layerB, Layer.succeed(C, { c: 'c' }))

const NeedsAB: Component<{}, never, A | B> = () => Effect.map(Effect.zip(A, B), ([a, b]) => el('p', {}, a.a + b.b))

// Provide removes only what the layer outputs; B stays in R
const app = Provide(layerA, NeedsAB({}))
expectTypeOf(app).toEqualTypeOf<Effect.Effect<Node, never, B>>()

// @ts-expect-error B is missing from the layer
void renderToString(app, { layer: layerA })
void renderToString(app, { layer: layerB })
// @ts-expect-error B missing at the root (layerA covers only A)
void renderToString(NeedsAB({}), { layer: layerA })
void renderToString(NeedsAB({}), { layer: layerAB })
// a layer providing more than needed compiles
void renderToString(NeedsAB({}), { layer: layerABC })

// fromReact needs nothing and fits any Component<P, E, R> slot
const Guest = fromReact((_: { n: number }) => null)
expectTypeOf(Guest).toEqualTypeOf<Component<{ n: number }, never, never>>()
expectTypeOf(Guest).toExtend<Component<{ n: number }, Error, A | B>>()
