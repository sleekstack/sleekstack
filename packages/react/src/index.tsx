/**
 * packages/react/src/index.tsx
 *
 * @sleekstack/react public barrel.
 *
 * Exports:
 *   LayerProvider  — component that owns ManagedRuntime lifecycle
 *   useService     — Suspense hook that resolves services from the nearest LayerProvider
 *   LayerProviderProps — prop type for LayerProvider
 *
 * Does NOT export: Runtime, Scope, Fiber, ServiceProvider, tryGetService,
 * provideService, or any prototype-era symbol (REACT-07, D-03, ADR 0001).
 */

export { LayerProvider } from './LayerProvider'
export { useService } from './useService'
export type { LayerProviderProps } from './LayerProvider'
