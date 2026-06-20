/**
 * packages/react/src/types.d.ts
 *
 * Public types for @sleekstack/react.
 * Re-exported from packages/react/src/index.tsx.
 *
 * Phase 1 exports only: LayerProvider, useService, LayerProviderProps.
 * Prototype-era types removed: ServiceOverrides, ServiceProviderProps,
 * ServiceProvider, TryGetResult, tryGetService, provideService (D-03, D-04).
 */

import type { Context } from 'effect'

/**
 * LayerProvider component — provides an Effect Layer graph to descendant components.
 *
 * Creates one ManagedRuntime per mount from the composed `provide` array.
 * On unmount, disposes the runtime and runs all Layer.scoped finalizers in reverse
 * acquisition order (REACT-08).
 *
 * Wrap children in a `<Suspense>` boundary (D-01).
 */
export declare function LayerProvider(props: LayerProviderProps): JSX.Element

/**
 * Resolve a service from the nearest ancestor LayerProvider.
 *
 * Returns synchronously if already cached (REACT-03). On first call, throws a Promise
 * (Suspense protocol, REACT-04) until the Layer acquires the service. If acquisition
 * fails, throws the error (caught by nearest ErrorBoundary, D-06).
 *
 * Wrap the calling component in a `<Suspense>` boundary (D-01, D-02).
 *
 * @param tag - The Effect Context.Tag identifying the service to resolve.
 * @returns The resolved service instance (T).
 */
export declare function useService<T>(tag: Context.Tag<any, T>): T
