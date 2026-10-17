import { Context, Layer } from 'effect'
import { declareLayer, module, type DeclaredLayer } from '@sleekstack/core'

class A extends Context.Tag('A')<A, string>() {}
class B extends Context.Tag('B')<B, string>() {}
class C extends Context.Tag('C')<C, string>() {}
class D extends Context.Tag('D')<D, string>() {}
// Core reads what a declared Layer provides from its type, so lists range over declared entries.
const la = declareLayer(Layer.succeed(A, 'x'))
const lb = declareLayer(Layer.succeed(B, 'x'))
const defs = [la, lb] as const

const looped: DeclaredLayer[] = []
for (const d of defs) looped.push(d)
declare const flag: boolean
if (flag) looped.push(declareLayer(Layer.succeed(C, 'c')))

export const Mapped = module({ name: 'Mapped', entries: defs.map((d) => d) })
export const Looped = module({ name: 'Looped', entries: looped })

declare const loose: any[]
export const Loose = module({ name: 'Loose', entries: loose.map((d) => d) }) // @error Computed
declare const widened: Layer.Layer<any>[]
export const Widened = module({ name: 'Widened', entries: widened }) // @error Computed

const pass = (d: DeclaredLayer) => d
declare const pick: boolean
const shared = defs.map(pass)
const Left = module({ name: 'Left', entries: shared })
const Right = module({ name: 'Right', entries: shared })
export const Named = module({
  name: 'Named',
  imports: [Left, Right],
  entries: [pick ? declareLayer(Layer.succeed(C, 'c')) : declareLayer(Layer.succeed(D, 'd'))],
})

// Helpers, called twice: each call makes its own layer (ambiguous); a parameterized one binds its own argument.
const fresh = () => [declareLayer(Layer.succeed(A, 'h'))] // @error AmbiguousProvider
const own = (xs: readonly DeclaredLayer[]) => xs.map((d) => d)
const H1 = module({ name: 'H1', entries: fresh() })
const H2 = module({ name: 'H2', entries: fresh().concat(own([lb]).slice()) })
export const Helpers = module({ name: 'Helpers', imports: [H1, H2] })
// A mapper returning one shared layer yields one provider; mapped modules stay distinct.
const sharedC = declareLayer(Layer.succeed(C, 'c'))
export const Reused = module({
  name: 'Reused',
  entries: defs.map(() => sharedC),
  imports: ['M1', 'M2'].map((n) => module({ name: n, entries: [] })),
})

// Fresh objects per iteration, even when the callback ignores its item: runtime sees two providers / two modules.
export const Fresh = module({ name: 'Fresh', entries: defs.map(() => declareLayer(Layer.succeed(C, 'c'))) }) // @error AmbiguousProvider
const twice: DeclaredLayer[] = []
for (const _ of defs) twice.push(declareLayer(Layer.succeed(D, 'd'))) // @error AmbiguousProvider
export const FreshLoop = module({ name: 'FreshLoop', entries: twice })
export const FreshModules = module({ name: 'FreshModules', imports: defs.map(() => module({ name: 'Same', entries: [] })) }) // @error DuplicateModule
// A callback delegating to a helper.
const mk = (d: DeclaredLayer) => d
export const Delegated = module({ name: 'Delegated', entries: defs.map((d) => mk(d)) })
