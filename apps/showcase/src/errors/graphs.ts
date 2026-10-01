/**
 * apps/showcase/src/errors/graphs.ts
 *
 * The error gallery's fixtures: deliberately broken plain-Layer runtimes. Never imported or
 * executed; `sleekstack check` reads each `configureRuntime({ layer })` call as a root and
 * reports its error with file:line in the prebuilt report, which the errors page renders.
 */
import { Context, Effect, Layer } from 'effect'
import { configureRuntime } from '@sleekstack/next'

class A extends Context.Tag('errors.A')<A, { readonly a: string }>() {}
class B extends Context.Tag('errors.B')<B, { readonly b: string }>() {}
interface Shared { readonly n: number }
const S1 = Context.GenericTag<Shared>('errors.S1')
const S2 = Context.GenericTag<Shared>('errors.S2')

const BLive = Layer.effect(B, Effect.map(A, ({ a }) => ({ b: a })))
const Untyped: any = BLive
const ALive = Layer.effect(A, Effect.map(B, ({ b }) => ({ a: b })))

configureRuntime({ layer: BLive } as never)
configureRuntime({ layer: Layer.mergeAll(Layer.succeed(S1, { n: 1 }), Layer.succeed(S2, { n: 2 })) } as never)
configureRuntime({ layer: Layer.mergeAll(BLive, Untyped) } as never)
configureRuntime({ layer: Layer.mergeAll(ALive, BLive) } as never)
