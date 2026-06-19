/**
 * packages/react/src/LayerProvider.tsx
 *
 * LayerProvider component — owns a ManagedRuntime lifecycle per mount.
 *
 * The runtime is created exactly once per mount (stored in useRef), disposed and
 * reset to null on unmount (required for React Strict Mode double-invoke safety).
 * Runtime, Scope, and Fiber are never exposed via props or exports (REACT-07, ADR 0001).
 *
 * @example
 * ```tsx
 * // Wrap children in <Suspense> — LayerProvider does NOT auto-wrap (D-01).
 * <LayerProvider provide={[MyLayer, MyModule]}>
 *   <Suspense fallback={<Loading />}>
 *     <MyComponent />
 *   </Suspense>
 * </LayerProvider>
 * ```
 */

import React, { useEffect, useRef } from 'react'
import { ManagedRuntime, Layer } from 'effect'
import { ProviderContext } from './context'
import type { ProviderState } from './context'
import type { Module } from '@sleekstack/core'

// --- Internal helpers ---

/**
 * Flatten a Module value to a single composed Layer.
 * Recursively collects this module's layers and all imported modules' layers,
 * then merges with Layer.mergeAll (last-in wins for duplicate Tags).
 */
function flattenModuleToLayer(mod: Module<any>): Layer.Layer<any, any, any> {
  const allLayers: Layer.Layer<any, any, any>[] = [...mod._layers]
  for (const imp of mod._imports ?? []) {
    allLayers.push(flattenModuleToLayer(imp))
  }
  if (allLayers.length === 0) {
    // Empty module — return a no-op Layer
    return Layer.empty
  }
  if (allLayers.length === 1) return allLayers[0]
  return Layer.mergeAll(...(allLayers as [Layer.Layer<any, any, any>, Layer.Layer<any, any, any>, ...Layer.Layer<any, any, any>[]]))
}

/**
 * Assemble a single composed Layer from the provide array.
 * Each entry is either a plain Effect Layer (passes through) or a Module value
 * (flattened to a Layer by collecting _layers + recursive _imports).
 */
function assembleLayer(
  provide: Array<Layer.Layer<any, any, any> | Module<any>>
): Layer.Layer<any, any, any> {
  const layers: Layer.Layer<any, any, any>[] = provide.map(entry => {
    // Detect Module: Module values have _name, _layers, _imports internal fields
    if (
      entry !== null &&
      typeof entry === 'object' &&
      '_name' in entry &&
      '_layers' in entry &&
      '_imports' in entry
    ) {
      return flattenModuleToLayer(entry as Module<any>)
    }
    // Plain Effect Layer — pass through
    return entry as Layer.Layer<any, any, any>
  })

  if (layers.length === 0) {
    return Layer.empty
  }
  if (layers.length === 1) return layers[0]
  return Layer.mergeAll(...(layers as [Layer.Layer<any, any, any>, Layer.Layer<any, any, any>, ...Layer.Layer<any, any, any>[]]))
}

// --- Component ---

export interface LayerProviderProps {
  readonly provide: ReadonlyArray<Layer.Layer<any, any, any> | Module<any>>
  readonly children?: React.ReactNode
}

/**
 * LayerProvider — provides an Effect Layer graph to descendant components via useService.
 *
 * Creates one ManagedRuntime per mount from the composed `provide` array.
 * On unmount, disposes the runtime (running all Layer.scoped finalizers in reverse
 * acquisition order) and resets the ref for safe Strict Mode remount.
 *
 * Wrap children in a `<Suspense>` boundary — LayerProvider does NOT auto-wrap (D-01).
 *
 * @example
 * ```tsx
 * <LayerProvider provide={[MyLayer]}>
 *   <Suspense fallback={<div>Loading...</div>}>
 *     <MyComponent />
 *   </Suspense>
 * </LayerProvider>
 * ```
 */
export function LayerProvider({ provide, children }: LayerProviderProps) {
  const stateRef = useRef<ProviderState | null>(null)

  // Initialize exactly once per mount (concurrent-safe null-guard).
  // Anti-pattern guarded: ManagedRuntime.make is NEVER called in every render body
  // unconditionally — only inside this null-guard (see RESEARCH.md Anti-Patterns).
  if (stateRef.current === null) {
    const composedLayer = assembleLayer(Array.from(provide))
    stateRef.current = {
      runtime: ManagedRuntime.make(composedLayer),
      cache: new Map(),
    }
  }

  useEffect(() => {
    // Cleanup on unmount: dispose runtime (finalizers run in reverse acq order)
    // and reset ref to null so Strict Mode remount re-creates a fresh runtime.
    // dispose() is idempotent — safe if called more than once (RESEARCH.md Pitfall 1).
    return () => {
      stateRef.current?.runtime.dispose()
      stateRef.current = null
    }
  }, []) // empty deps: only runs on mount/unmount

  return (
    <ProviderContext.Provider value={stateRef.current}>
      {children}
    </ProviderContext.Provider>
  )
}
