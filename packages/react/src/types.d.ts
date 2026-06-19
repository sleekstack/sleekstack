/**
 * packages/react/src/types.d.ts
 *
 * Public types for the SleekStack React integration (Phase 1).
 * No implementation — only API contracts and behavioral notes below.
 */

import type { ReactNode } from 'react'
import type { ServiceTag, LayerLike } from '@sleekstack/core'
import type * as Effect from 'effect'

/**
 * Layer override map.
 * - Keys are ServiceTag<T> objects and values are LayerLike<T> that will override any parent-provided layer.
 * - A provider may accept overrides either as an array of LayerLike or as a Map/Record keyed by tag.
 *
 * Note: equality semantics for keys must be by identity (reference equality).
 */
export type LayerOverrides = Map<ServiceTag<any>, LayerLike<any>>

/**
 * Props for the LayerProvider component.
 *
 * Semantics:
 * - `layers`: an array of LayerLike<T> that this provider contributes to the subtree environment.
 * - `overrides`: optional precise overrides that replace parent-provided layers for the specified tags.
 * - `children`: React subtree.
 *
 * Override rule: If the same ServiceTag exists in both `layers` and `overrides`, the `overrides` entry wins.
 * Child providers override parent providers for the same ServiceTag.
 *
 * Deterministic cleanup rule: All resources acquired by layers that are used/allocated within this provider
 * must be released when the provider unmounts. The cleanup order should be the inverse of acquisition order.
 */
export interface LayerProviderProps {
  readonly layers?: readonly LayerLike<any>[] | undefined
  readonly overrides?: LayerOverrides | undefined
  readonly children?: ReactNode | undefined
}

/**
 * LayerProvider React component.
 *
 * Contract:
 * - Must create and own a scope/runtime for the subtree.
 * - Must not share mutable runtime state across sibling providers.
 * - On unmount it MUST run all finalizers for resources acquired under this provider's scope.
 */
export const LayerProvider: (props: LayerProviderProps) => JSX.Element

/**
 * useService hook.
 *
 * Behavior contract:
 * - When called inside a `LayerProvider` subtree:
 *   - If the service value is already initialized and available synchronously, return it.
 *   - If the service is not yet initialized and its construction is asynchronous, the hook MUST cause the component to suspend by throwing a Promise that resolves when the service is ready (Suspense integration).
 *   - If the service construction fails, the hook MUST throw the original error (so an error boundary can catch it).
 * - If no provider has registered a layer for the requested tag, the hook MUST throw an Error describing the missing dependency.
 *
 * Signature:
 *   function useService<T>(tag: ServiceTag<T>): T
 */
export function useService<T>(tag: ServiceTag<T>): T

/**
 * Variant hook: tryGetService
 * - Returns a tuple [value | undefined, readyPromise | undefined, error | undefined]
 * - Useful for non-suspense usage or debug tooling.
 */
export type TryGetResult<T> = {
  readonly value?: T
  readonly pending?: Promise<T>
  readonly error?: unknown
}

/**
 * Try to obtain a service without suspending:
 * - If the service is ready, return { value }.
 * - If the service is currently being constructed, return { pending: Promise }.
 * - If the service production threw, return { error }.
 * - If no layer exists for the tag, return { error: MissingDependencyError } (do not throw).
 */
export function tryGetService<T>(tag: ServiceTag<T>): TryGetResult<T>

/**
 * Convenience: provideLayer() helper for dynamic layer composition at runtime.
 *
 * Optional: implementations may expose a context API to programmatically provide a new layer to
 * a subtree (for tests or dynamic overrides). The method below is recommended but optional for Phase 1.
 *
 * Signature:
 *   function provideLayer<T>(layer: LayerLike<T>): (() => void)
 *
 * Contract:
 * - When called, it installs the layer for the current provider subtree and returns a synchronous
 *   disposer function that removes the installed layer and runs any cleanup for resources allocated by it.
 */
export function provideLayer<T>(layer: LayerLike<T>): () => void

