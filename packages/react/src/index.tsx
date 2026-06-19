import React, { createContext, useContext, useEffect, useRef } from 'react'
import type { Layer, ServiceTag, EnvProxy } from '@sleekstack/core'

type Entry = {
  value?: unknown
  promise?: Promise<void>
  cleanup?: (() => void | Promise<void>) | undefined
}

type ProviderState = {
  layers: Map<symbol, Layer<any>>
  env: Map<symbol, Entry>
}

/**
 * Provider context - contains the layers available at this subtree and the environment map.
 * Layers are keyed by tag.id.
 */
const ProviderContext = createContext<ProviderState | null>(null)

/**
 * LayerProvider props
 * - `layers`: list of layers that this provider contributes (order doesn't matter)
 * - `children`: React subtree
 *
 * This provider is lazy: layer factories are only invoked when `useService` requests the tag.
 */
export function LayerProvider({
  layers = [],
  children,
}: {
  layers?: Layer<any>[]
  children?: React.ReactNode
}) {
  const layersRef = useRef<Map<symbol, Layer<any>>>()
  const envRef = useRef<Map<symbol, Entry>>()

  if (!layersRef.current) {
    layersRef.current = new Map(layers.map((l) => [l.tag.id, l]))
  } else {
    // allow re-creating provider with new layers (e.g., overrides)
    layersRef.current = new Map(layers.map((l) => [l.tag.id, l]))
  }

  if (!envRef.current) envRef.current = new Map()

  // cleanup on unmount: run all known cleanup functions deterministically
  useEffect(() => {
    return () => {
      const env = envRef.current!
      for (const entry of env.values()) {
        if (entry.cleanup) {
          // fire and forget cleanup, but swallow errors
          Promise.resolve(entry.cleanup()).catch(() => {})
        }
      }
    }
  }, [])

  const state: ProviderState = {
    layers: layersRef.current,
    env: envRef.current,
  }

  return <ProviderContext.Provider value={state}>{children}</ProviderContext.Provider>
}

/**
 * Returns a proxy environment that `Layer.factory` can use to get other services.
 * If the dependency is not yet built, this `get` will trigger the dependent layer's factory and either
 * return its value (if synchronous) or a Promise.
 *
 * Important: This implementation throws a Promise to signal Suspense where necessary:
 * - At the React layer, `useService` will throw the promise returned when building a service.
 */
function makeEnvProxy(state: ProviderState): EnvProxy {
  return {
    get<T>(tag: ServiceTag<T>): T | Promise<T> {
      const key = tag.id
      const env = state.env
      const existing = env.get(key)
      if (existing?.value !== undefined) {
        return existing.value as T
      }
      if (existing?.promise) {
        // Dependency is currently being built -> return a promise that resolves to the value when built
        return existing.promise.then(() => {
          const final = env.get(key)
          return final!.value as T
        })
      }

      // If we have a layer for the dependency, start building it lazily.
      const layer = state.layers.get(key)
      if (!layer) {
        throw new Error(`Dependency not found: ${tag.name ?? String(tag.id)}`)
      }

      // Start building dependency:
      const p = (async () => {
        const res = await layer.factory(makeEnvProxy(state))
        const ent = env.get(key) ?? {}
        ent.value = res.value
        ent.cleanup = res.cleanup
        ent.promise = undefined
        env.set(key, ent)
      })()

      const ent: Entry = { promise: p }
      env.set(key, ent)

      // Return a Promise<T> to the caller (factory), so the factory can `await env.get(X)`
      return p.then(() => {
        const final = env.get(key)!
        return final.value as T
      })
    },
  }
}

/**
 * useService(tag) - React hook to get a service instance by tag.
 * - If the service is not yet built and is asynchronous, this will throw a Promise to trigger Suspense.
 * - If the service is available, it returns it synchronously.
 */
export function useService<T>(tag: ServiceTag<T>): T {
  const state = useContext(ProviderContext)
  if (!state) throw new Error('useService must be used within a LayerProvider')

  const key = tag.id
  const env = state.env
  const existing = env.get(key)
  if (existing?.value !== undefined) return existing.value as T
  if (existing?.promise) {
    // The entry is currently building — throw a promise so React Suspense will suspend.
    throw existing.promise.then(() => {
      // no-op: resolving the promise will cause a re-render and the hook will return value next time
    })
  }

  const layer = state.layers.get(key)
  if (!layer) {
    throw new Error(`No layer registered for ${tag.name ?? String(tag.id)}. Did you forget to provide it?`)
  }

  // Lazy start building the service. Build process populates env and sets cleanup.
  const p = (async () => {
    const res = await layer.factory(makeEnvProxy(state))
    const ent = env.get(key) ?? {}
    ent.value = res.value
    ent.cleanup = res.cleanup
    ent.promise = undefined
    env.set(key, ent)
  })()

  const ent: Entry = { promise: p }
  env.set(key, ent)

  // Throw the build promise so Suspense will suspend this component until the service is ready.
  throw p.then(() => {
    /* resolved -> re-render */
  })
}