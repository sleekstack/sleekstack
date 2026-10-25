import { Context, Effect, Layer } from 'effect'
import type { YieldWrap } from 'effect/Utils'

type Deps = Record<string, Context.Tag<any, any>>
type Provided<D extends Deps> = { readonly [K in keyof D]: Context.Tag.Service<D[K]> }
type Needs<D extends Deps> = Context.Tag.Identifier<D[keyof D]>

/** What a generator method asks of its caller: the Effect it runs as, needing the service itself too. */
type Call<Self, G> =
  G extends Generator<infer Y, infer A, any>
    ? Effect.Effect<
        A,
        [Y] extends [never] ? never : [Y] extends [YieldWrap<Effect.Effect<any, infer E, any>>] ? E : never,
        Self | ([Y] extends [never] ? never : [Y] extends [YieldWrap<Effect.Effect<any, any, infer R>>] ? R : never)
      >
    : never

/** Each generator method of a service as a function that asks for the service. */
type Accessors<Self> = {
  [K in keyof Self as Self[K] extends (...args: any) => Generator<any, any, any> ? K : never]: Self[K] extends (
    ...args: infer A
  ) => infer G
    ? (...args: A) => Call<Self, G>
    : never
}

type ServiceClass<Self, D extends Deps> = (new (provided: Provided<D>) => Provided<D>) &
  Context.Tag<Self, Self> & { readonly Default: Layer.Layer<Self, never, Needs<D>> }

const GeneratorFunction = Object.getPrototypeOf(function* () {}).constructor

/**
 * A base class for a service written as a plain class of generator methods:
 *
 *     class Articles extends Service<Articles>()('app/Articles', { db: Db }) {
 *       *get(slug: string) { return this.db.prepare(...).get(slug) }
 *     }
 *
 * - The second argument names the Tags the service needs; each is on `this` under its name, and `Articles.Default` is
 *   the Layer that builds the service from them.
 * - Every generator method runs as an Effect (`Effect.fn`, spanned as `app/Articles.get`), also when another method
 *   calls it with `yield* this.get(slug)`.
 * - The class is itself the Tag: `yield* Articles`, `Layer.succeed(Articles, ...)`.
 * - TypeScript types a generator method as a Generator, so callers use `accessors(Articles)`, whose methods are the
 *   Effects. A class cannot type its own statics from its own body, so this is one line per service.
 */
export const Service =
  <Self>() =>
  <const D extends Deps = {}>(key: string, deps?: D): ServiceClass<Self, D> => {
    const tag = Context.GenericTag<Self, Self>(key)
    const layers = new WeakMap<object, Layer.Layer<any, never, any>>()

    class Base {
      constructor(provided: Provided<D>) {
        Object.assign(this, provided)
        for (
          let proto = Object.getPrototypeOf(this);
          proto && proto !== Base.prototype;
          proto = Object.getPrototypeOf(proto)
        ) {
          for (const name of Object.getOwnPropertyNames(proto)) {
            const method = Object.getOwnPropertyDescriptor(proto, name)?.value
            if (name !== 'constructor' && !Object.hasOwn(this, name) && method?.constructor === GeneratorFunction) {
              Object.defineProperty(this, name, { value: Effect.fn(`${key}.${name}`)(method) })
            }
          }
        }
      }
    }

    // The class borrows the Tag's identity and adds `Default` and the method accessors, found through the subclass.
    Object.setPrototypeOf(
      Base,
      new Proxy(tag, {
        get(target, prop, receiver) {
          if (prop === 'Default') {
            let layer = layers.get(receiver)
            if (!layer) {
              const needed = Object.fromEntries(Object.entries(deps ?? {}))
              layer = Layer.effect(
                receiver,
                Effect.map(Effect.all(needed), (provided) => new receiver(provided)),
              )
              layers.set(receiver, layer)
            }
            return layer
          }
          return Reflect.get(target, prop, receiver)
        },
      }),
    )
    return Base as unknown as ServiceClass<Self, D>
  }

/** `accessors(Articles).get(slug)` asks for the service from the environment and runs its generator method `get`. */
export const accessors = <Self>(service: Context.Tag<Self, Self>) =>
  new Proxy({} as Accessors<Self>, {
    get:
      (_, name: string) =>
      (...args: unknown[]) =>
        Effect.flatMap(service, (instance: any) => instance[name](...args)),
  })
