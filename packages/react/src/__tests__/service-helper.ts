import { Effect, Layer, type Context, type Scope } from 'effect'
import { declareLayer, type Lifetime } from '@sleekstack/core'

/** Test sugar: a declared Layer built from a Tag, the Tags it `requires` (resolved first, in order) and a `make` over them. */
export const service = (
  tag: Context.Tag<any, any>,
  opts: { readonly requires?: readonly Context.Tag<any, any>[]; readonly lifetime?: Lifetime },
  make: (deps: any) => Effect.Effect<any, any, Scope.Scope>,
) =>
  declareLayer(Layer.scoped(tag, Effect.flatMap(Effect.all(opts.requires ?? []), make)) as Layer.Layer<any, any, any>, {
    lifetime: opts.lifetime,
  })
