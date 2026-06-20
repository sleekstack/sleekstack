/**
 * packages/react/src/LayerProvider.tsx
 *
 * LayerProvider component — owns a ManagedRuntime lifecycle per mount.
 *
 * Single-scope (top-level) providers create a ManagedRuntime from the composed
 * provide array. Nested providers inherit the parent's resolved Effect context so
 * child layers can resolve services the parent provides, and child layers placed
 * in provide shadow parent services for the same Tag via Layer.mergeAll ordering.
 *
 * The runtime is created exactly once per mount (stored in useRef), disposed and
 * reset to null on unmount (required for React Strict Mode double-invoke safety).
 * Runtime, Scope, and Fiber are never exposed via props or exports (REACT-07, ADR 0001).
 *
 * ## Finalization order (REACT-02)
 *
 * React 19 runs useEffect cleanups in parent-before-child order during unmount.
 * To achieve inner-before-outer finalization, a nested LayerProvider registers its
 * dispose with the parent's `registerChildDispose`. The outer LayerProvider's cleanup
 * calls all registered child disposals (LIFO order) before disposing its own runtime.
 *
 * @example
 * ```tsx
 * // Top-level — wrap children in <Suspense> (D-01: user owns the boundary).
 * <LayerProvider provide={[MyLayer, MyModule]}>
 *   <Suspense fallback={<Loading />}>
 *     <MyComponent />
 *   </Suspense>
 * </LayerProvider>
 *
 * // Nested — child layers shadow parent layers for duplicate Tags (ADR 0003).
 * <LayerProvider provide={[MockDatabaseLayer]}>
 *   <Suspense fallback={<Loading />}>
 *     <MyComponent />
 *   </Suspense>
 * </LayerProvider>
 * ```
 */

import React, { useContext, useEffect, useRef } from 'react'
import { ManagedRuntime, Layer, Effect } from 'effect'
import { ProviderContext } from './context'
import type { ProviderState } from './context'
import type { Module } from '@sleekstack/core'

// --- Internal helpers ---

/**
 * Flatten a Module value to a single composed Layer.
 * Recursively collects this module's layers and all imported modules' layers,
 * then merges with Layer.mergeAll (last-in wins for duplicate Tags).
 *
 * CORE-03: Imported modules are automatically pulled into scope — the consumer
 * only lists the top-level Module in provide; all transitive imports are included.
 */
function flattenModuleToLayer(mod: Module<any>): Layer.Layer<any, any, any> {
  const allLayers: Layer.Layer<any, any, any>[] = [...mod._layers]
  for (const imp of mod._imports ?? []) {
    allLayers.push(flattenModuleToLayer(imp))
  }
  if (allLayers.length === 0) {
    // Empty module — return a no-op Layer; cast to satisfy return type
    return Layer.empty as unknown as Layer.Layer<any, any, any>
  }
  if (allLayers.length === 1) return allLayers[0]
  return Layer.mergeAll(...(allLayers as [Layer.Layer<any, any, any>, Layer.Layer<any, any, any>, ...Layer.Layer<any, any, any>[]]))
}

/**
 * Assemble the final composed Layer for ManagedRuntime.make.
 *
 * For top-level providers (no parent): merges own layers only.
 * For nested providers (with parent context layer): places the parent context
 * FIRST in Layer.mergeAll and own layers LAST, so own layers shadow parent services
 * for duplicate Tags (REACT-05, Pitfall 2: last-in-array wins; ADR 0003).
 */
function assembleLayer(
  provide: Array<Layer.Layer<any, any, any> | Module<any>>,
  parentContextLayer?: Layer.Layer<any, any, any>
): Layer.Layer<any, any, any> {
  // Expand Modules to their flattened Layer equivalents (CORE-03 auto-pull).
  const ownLayers: Layer.Layer<any, any, any>[] = provide.map(entry => {
    if (
      entry !== null &&
      typeof entry === 'object' &&
      '_name' in entry &&
      '_layers' in entry &&
      '_imports' in entry
    ) {
      return flattenModuleToLayer(entry as Module<any>)
    }
    return entry as Layer.Layer<any, any, any>
  })

  if (parentContextLayer) {
    // Nested provider: parent context first (lower precedence), own layers last (higher precedence).
    // Layer.mergeAll last-in-array wins — child overrides parent for duplicate Tags (ADR 0003).
    const allLayers: Layer.Layer<any, any, any>[] = [parentContextLayer, ...ownLayers]
    if (allLayers.length === 1) return allLayers[0]
    return Layer.mergeAll(...(allLayers as [Layer.Layer<any, any, any>, Layer.Layer<any, any, any>, ...Layer.Layer<any, any, any>[]]))
  }

  // Top-level provider: no parent, merge own layers only.
  if (ownLayers.length === 0) {
    return Layer.empty as unknown as Layer.Layer<any, any, any>
  }
  if (ownLayers.length === 1) return ownLayers[0]
  return Layer.mergeAll(...(ownLayers as [Layer.Layer<any, any, any>, Layer.Layer<any, any, any>, ...Layer.Layer<any, any, any>[]]))
}

/**
 * Dispose a ManagedRuntime synchronously, with a fallback to async if needed.
 * Used in both the outer and inner cleanup paths.
 */
function disposeRuntime(runtime: ManagedRuntime.ManagedRuntime<any, never>): void {
  try {
    runtime.runSyncExit(
      (runtime as any).disposeEffect
    )
  } catch {
    // Fallback to async dispose if runSyncExit is unavailable or throws.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(runtime as any).dispose?.()
  }
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
 * Nested providers inherit the parent's resolved context — a child that does NOT
 * provide a service can still resolve it from the nearest ancestor that does.
 * Child layers placed in `provide` shadow parent layers for the same Tag (ADR 0003).
 *
 * For nested providers, the parent's Effect context is extracted synchronously via
 * `ManagedRuntime.runSync(Effect.context())`. This works because the parent runtime
 * builds its layer synchronously the first time it is accessed. Layers with async
 * effects (e.g. `Effect.promise`) cannot be used in nested providers — use
 * `Effect.acquireRelease` with synchronous acquire, or `Layer.succeed`.
 *
 * Wrap children in a `<Suspense>` boundary — LayerProvider does NOT auto-wrap (D-01).
 *
 * @example
 * ```tsx
 * <LayerProvider provide={[DatabaseLayer]}>
 *   <Suspense fallback={<div>Loading...</div>}>
 *     <LayerProvider provide={[MockDatabaseLayer]}>
 *       <Suspense fallback={<div>Loading inner...</div>}>
 *         <MyComponent />
 *       </Suspense>
 *     </LayerProvider>
 *   </Suspense>
 * </LayerProvider>
 * ```
 */
export function LayerProvider({ provide, children }: LayerProviderProps) {
  const stateRef = useRef<ProviderState | null>(null)
  const parentState = useContext(ProviderContext)

  // Initialize exactly once per mount (concurrent-safe null-guard).
  // Anti-pattern guarded: ManagedRuntime.make is NEVER called in every render body
  // unconditionally — only inside this null-guard (see RESEARCH.md Anti-Patterns).
  if (stateRef.current === null) {
    let parentContextLayer: Layer.Layer<any, any, any> | undefined

    if (parentState !== null) {
      // --- Nested provider: inherit parent's resolved Effect context ---
      // Extract the parent's built context synchronously. ManagedRuntime.runSync
      // builds the parent's layer on first access, then returns the context.
      // This avoids async suspension and works for all Layer types used in practice
      // (Layer.succeed, Layer.scoped with sync acquire — see Plan 01-04 design note).
      const parentCtx = parentState.runtime.runSync(Effect.context<never>())
      parentContextLayer = Layer.succeedContext(parentCtx) as unknown as Layer.Layer<any, any, any>
    }

    const composedLayer = assembleLayer(Array.from(provide), parentContextLayer)
    // Cast to satisfy ProviderState.runtime type (ManagedRuntime<any, never>).
    // ManagedRuntime.make infers the error type from the layer; we assert never here
    // since the composed layer is self-contained (all deps provided internally).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runtime = ManagedRuntime.make(composedLayer as Layer.Layer<any, any, never>) as any

    const childDisposals: (() => void)[] = []

    stateRef.current = {
      runtime,
      cache: new Map(),
      _childDisposals: childDisposals,
      registerChildDispose(fn: () => void): () => void {
        childDisposals.push(fn)
        return () => {
          const idx = childDisposals.lastIndexOf(fn)
          if (idx !== -1) childDisposals.splice(idx, 1)
        }
      },
    }
  }

  useEffect(() => {
    const state = stateRef.current

    // --- Nested provider: register this provider's dispose with the parent ---
    // React 19 runs useEffect cleanups in parent-before-child order. To ensure
    // inner-before-outer finalization (REACT-02), the inner provider registers its
    // dispose with the parent. The parent calls registered child disposals (LIFO)
    // before its own dispose.
    let unregister: (() => void) | undefined
    if (parentState !== null && state !== null) {
      unregister = parentState.registerChildDispose(() => {
        if (stateRef.current !== null) {
          disposeRuntime(stateRef.current.runtime)
          stateRef.current = null
        }
      })
    }

    return () => {
      // Unregister from parent FIRST (prevent double-disposal — parent calls child
      // dispose, then child would try to dispose again from its own cleanup).
      unregister?.()

      if (stateRef.current !== null) {
        // Run registered child disposals in LIFO order before own dispose.
        // This ensures inner scopes finalize before outer scopes (REACT-02).
        const disposals = [...stateRef.current._childDisposals].reverse()
        for (const fn of disposals) {
          fn()
        }

        disposeRuntime(stateRef.current.runtime)
        stateRef.current = null
      }
    }
  }, []) // empty deps: only runs on mount/unmount

  return (
    <ProviderContext.Provider value={stateRef.current}>
      {children}
    </ProviderContext.Provider>
  )
}
