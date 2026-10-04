/**
 * packages/react/src/index.tsx — @sleekstack/react public barrel.
 * Runtime, Scope, and Fiber are intentionally not exported.
 */

export { LayerProvider, closeProvidersOn } from './LayerProvider'
export { useService } from './useService'
export { useEffectTransition } from './useTransition'
export type { LayerProviderProps } from './LayerProvider'
export { useAtomValue, useAtomSet, useAtom, useAtomRefresh, useAtomSuspense } from './atoms'
export { AtomsSnapshot } from './AtomsSnapshot'
export { renderWithAtoms } from './renderWithAtoms'
export type { RenderWithAtomsStream } from './renderWithAtoms'
export { QueryProvider } from './query'
