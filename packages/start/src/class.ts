import { Context, Effect, Layer } from 'effect'
import type { YieldWrap } from 'effect/Utils'
import type { ControllerMethodEntry } from './app'
import { type Method, methods as httpMethods } from './handler'

type Deps = Record<string, Context.Tag<any, any>>
type Provided<D extends Deps> = { readonly [K in keyof D]: Context.Tag.Service<D[K]> }
type Needs<D extends Deps> = Context.Tag.Identifier<D[keyof D]>

/**
 * The written return type of a generator method of a {@link Service} or a {@link Controller}: a `Generator` of yielded
 * Effects ending in `A`, the shape `Effect.gen` runs. TypeScript checks the body against it, and the analyzer reads `A`,
 * `E` and `R` as it reads them for an `Effect`.
 *
 * @example
 * ```ts
 * import { type Gen } from '@sleekstack/start'
 * import { Data, Effect } from 'effect'
 *
 * class Empty extends Data.TaggedError('Empty') {}
 *
 * function* first(items: ReadonlyArray<string>): Gen<string, Empty> {
 *   return items[0] ?? (yield* new Empty())
 * }
 *
 * export const program = Effect.gen(() => first(['a']))
 * ```
 */
export type Gen<A, E = never, R = never> = Generator<YieldWrap<Effect.Effect<any, E, R>>, A, any>

/** What a generator method asks of its caller: the Effect it runs as, needing the service itself too. */
export type Call<Self, G> =
  G extends Generator<infer Y, infer A, any>
    ? Effect.Effect<
        A,
        [Y] extends [never] ? never : [Y] extends [YieldWrap<Effect.Effect<any, infer E, any>>] ? E : never,
        Self | ([Y] extends [never] ? never : [Y] extends [YieldWrap<Effect.Effect<any, any, infer R>>] ? R : never)
      >
    : never

/** Each generator method of a service as a function that asks for the service. */
export type Accessors<Self> = {
  [K in keyof Self as Self[K] extends (...args: any) => Generator<any, any, any> ? K : never]: Self[K] extends (
    ...args: infer A
  ) => infer G
    ? (...args: A) => Call<Self, G>
    : never
}

/**
 * The Controller Methods of the class Controller `C` as the functions they run as, each an Effect of its written `Gen`.
 * The generated `ControllerModules` names it for a class Controller file, so an RPC Manifest entry types against it.
 */
export type ControllerMethodsOf<C extends abstract new (...args: any) => any> = {
  readonly [K in Extract<keyof InstanceType<C>, Method>]: InstanceType<C>[K] extends (...args: infer A) => infer G
    ? (...args: A) => Call<never, G>
    : never
}

type ServiceClass<Self, D extends Deps> = (new (provided: Provided<D>) => Provided<D>) &
  Context.Tag<Self, Self> & { readonly Default: Layer.Layer<Self, never, Needs<D>> }

type ControllerClass<D extends Deps> = (new (provided: Provided<D>) => Provided<D>) & {
  /**
   * The `run` of the class's Controller Method `method`, for its generated entry: per request it resolves the declared
   * Tags from the request's context, builds the instance and runs the method with the instance as `this`.
   */
  readonly run: <C extends abstract new (...args: any) => any>(
    this: C,
    method: Extract<keyof InstanceType<C>, Method>,
  ) => ControllerMethodEntry['run']
}

type Generators = ReadonlyArray<readonly [name: string, method: (...args: any) => any]>

const GeneratorFunction = Object.getPrototypeOf(function* () {}).constructor
const found = new WeakMap<object, Generators>()

/**
 * The generator methods of `proto`'s class, inherited ones included, down to `base` (the nearest definition of a name
 * wins). A declared name that is `constructor`, `reserved` or a method of the class is a defect.
 */
const generators = (proto: object, base: object, deps: Deps, reserved: ReadonlyArray<string>): Generators => {
  let list = found.get(proto)
  if (list) return list
  const seen = new Set<string>()
  const generators: Array<readonly [string, (...args: any) => any]> = []
  for (let p = proto; p && p !== base; p = Object.getPrototypeOf(p)) {
    for (const name of Object.getOwnPropertyNames(p)) {
      if (name === 'constructor' || seen.has(name)) continue
      seen.add(name)
      const method = Object.getOwnPropertyDescriptor(p, name)?.value
      if (method?.constructor === GeneratorFunction) generators.push([name, method])
    }
  }
  for (const name of Object.keys(deps)) {
    if (name === 'constructor' || seen.has(name) || reserved.includes(name)) {
      throw new Error(`The declared dependency "${name}" collides with a method name of the class`)
    }
  }
  list = generators
  found.set(proto, list)
  return list
}

/** Each Service key and the site that defined it. */
const keys = new Map<string, string | undefined>()

/**
 * The `file:line:column` of the `Service<Self>()(...)` call, the file without its query, from the V8 stack: a dev reload
 * re-runs a Service file (often with a `?t=` query) while `@sleekstack/start` stays loaded, and the same site running
 * again must not be a duplicate key, while another site with the key, in any file, is.
 */
const callerSite = (): string | undefined => {
  const site = new Error().stack?.split('\n')[3]?.match(/\(?([^()\s]+?):(\d+:\d+)\)?$/)
  return site ? `${site[1]!.replace(/\?.*$/, '')}:${site[2]}` : undefined
}

/**
 * A base class for a service written as a plain class of generator methods. The second argument names the Tags the
 * service needs; each is on `this` under its name, and `Default` is the Layer that builds the service from them, once
 * with the app's Layer. A service may declare another service.
 *
 * - Every generator method runs as an Effect (`Effect.fn`, spanned as `<key>.<method>`), also when another method calls
 *   it with `yield* this.method()`, and also when it is inherited. A non-generator method is left as it is.
 * - The class is itself the Tag: `yield* Articles`, `Layer.succeed(Articles, ...)`.
 * - TypeScript types a generator method as a `Generator`, so a caller that is not itself a generator uses
 *   {@link accessors}. `super` calls to an inherited generator method are not supported.
 * - A key used by another `Service`, in the same file or another, and a declared name that is `constructor` or a method
 *   of the class, are defects when the class is defined or first built. A file that runs again (a dev reload) may
 *   define its keys again from the same place.
 *
 * @example
 * ```ts
 * import { Service } from '@sleekstack/start'
 * import { Context, Effect, Layer } from 'effect'
 *
 * class Clock extends Context.Tag('app/Clock')<Clock, { readonly now: () => number }>() {}
 *
 * class Greeter extends Service<Greeter>()('app/Greeter', { clock: Clock }) {
 *   *greet(name: string) {
 *     return `Hello ${name} at ${this.clock.now()}`
 *   }
 * }
 *
 * export const program = Effect.gen(function* () {
 *   const greeter = yield* Greeter
 *   return yield* greeter.greet('Ada')
 * }).pipe(Effect.provide(Greeter.Default.pipe(Layer.provide(Layer.succeed(Clock, { now: () => 0 })))))
 * ```
 */
export const Service =
  <Self>() =>
  <const D extends Deps = {}>(key: string, deps?: D): ServiceClass<Self, D> => {
    const site = callerSite()
    if (keys.has(key) && (site === undefined || keys.get(key) !== site))
      throw new Error(`The Service key "${key}" is already used by another Service`)
    keys.set(key, site)
    const declared: Deps = deps ?? {}
    const tag = Context.GenericTag<Self, Self>(key)
    const layers = new WeakMap<object, Layer.Layer<any, never, any>>()

    class Base {
      constructor(provided: Provided<D>) {
        Object.assign(this, provided)
        for (const [name, method] of generators(Object.getPrototypeOf(this), Base.prototype, declared, [])) {
          Object.defineProperty(this, name, { value: Effect.fn(`${key}.${name}`)(method) })
        }
      }
    }

    // The class borrows the Tag's identity and adds `Default`, found through the subclass.
    Object.setPrototypeOf(
      Base,
      new Proxy(tag, {
        get(target, prop, receiver) {
          if (prop !== 'Default') return Reflect.get(target, prop, receiver)
          let layer = layers.get(receiver)
          if (!layer) {
            generators(receiver.prototype, Base.prototype, declared, [])
            layer = Layer.effect(
              receiver,
              Effect.map(Effect.all(declared), (provided) => new receiver(provided)),
            )
            layers.set(receiver, layer)
          }
          return layer
        },
      }),
    )
    return Base as unknown as ServiceClass<Self, D>
  }

/**
 * The generator methods of a {@link Service} as Effects that ask for the service from the environment, for a caller
 * that is not itself a generator. It exists because a class cannot type its own statics from its own body; method
 * generics, overloads and optional-parameter forms are not preserved.
 *
 * @example
 * ```ts
 * import { accessors, Service } from '@sleekstack/start'
 * import { Effect } from 'effect'
 *
 * class Counter extends Service<Counter>()('app/Counter') {
 *   *add(a: number, b: number) {
 *     return a + b
 *   }
 * }
 *
 * export const three = accessors(Counter).add(1, 2).pipe(Effect.provide(Counter.Default))
 * ```
 */
export const accessors = <Self>(service: Context.Tag<Self, Self>): Accessors<Self> =>
  new Proxy({} as Accessors<Self>, {
    get:
      (_, name: string) =>
      (...args: unknown[]) =>
        Effect.flatMap(service, (instance: any) => instance[name](...args)),
  })

const controllers = new WeakMap<object, Generators>()

/**
 * A base class for the default export of a `*.controller.ts` file: its generator methods named after HTTP methods are
 * the Controller Methods, and the record names the Tags it needs, each on `this` under its name. The instance is built
 * per request, inside the `wrap` chain, so a declared Tag may be a per-request service such as the viewer; a missing
 * one fails the request as any missing service does. Each generator method is wrapped once per class (spanned as
 * `<ClassName>.<method>`) and runs with the instance as `this`, also for `yield* this.method()`. A non-generator method
 * is left as it is, and `super` calls to an inherited generator method are not supported. A declared name that is
 * `constructor`, an HTTP method or a method of the class is a defect. `Controller()` and `Controller({})` declare
 * nothing.
 *
 * @example
 * ```ts
 * import { Controller, type Gen } from '@sleekstack/start'
 * import { Context } from 'effect'
 *
 * class Greetings extends Context.Tag('app/Greetings')<Greetings, { readonly hello: string }>() {}
 *
 * export default class extends Controller({ greetings: Greetings }) {
 *   *GET(input: { readonly params: { readonly name: string } }): Gen<string> {
 *     return `${this.greetings.hello} ${input.params.name}`
 *   }
 * }
 * ```
 */
export const Controller = <const D extends Deps = {}>(deps?: D): ControllerClass<D> => {
  const declared: Deps = deps ?? {}
  const wrapped = (Class: any): Generators => {
    let list = controllers.get(Class)
    if (!list) {
      const name = Class.name && Class.name !== 'default' ? Class.name : 'Controller'
      list = generators(Class.prototype, Base.prototype, declared, httpMethods).map(
        ([method, body]) => [method, Effect.fn(`${name}.${method}`)(body)] as const,
      )
      controllers.set(Class, list)
    }
    return list
  }

  class Base {
    constructor(provided: Provided<D>) {
      Object.assign(this, provided)
      for (const [name, method] of wrapped(new.target)) Object.defineProperty(this, name, { value: method })
    }

    static run(this: any, method: string): ControllerMethodEntry['run'] {
      if (!wrapped(this).some(([name]) => name === method)) {
        throw new Error(`The Controller "${this.name}" has no generator method ${method}`)
      }
      return (input) => Effect.flatMap(Effect.all(declared), (provided) => new this(provided)[method](input))
    }
  }
  return Base as unknown as ControllerClass<D>
}
