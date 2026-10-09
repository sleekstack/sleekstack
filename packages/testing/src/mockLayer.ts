import { Layer, type Context } from 'effect'

/**
 * A Layer for `tag` from a partial implementation. Calling a method the mock does not supply throws (a defect when
 * called inside an Effect) naming the service and method.
 */
export const mockLayer = <I, S extends object>(tag: Context.Tag<I, S>, partial: Partial<S>): Layer.Layer<I> =>
  Layer.succeed(
    tag,
    new Proxy(partial, {
      get: (target, key) =>
        Object.hasOwn(target, key) || typeof key === 'symbol' || key === 'then'
          ? Reflect.get(target, key)
          : () => {
              throw new Error(`mockLayer: ${tag.key}.${key} is not implemented`)
            },
    }) as S,
  )
