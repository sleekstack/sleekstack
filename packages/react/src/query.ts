/**
 * packages/react/src/query.ts
 *
 * `QueryProvider`: feeds `@tanstack/react-query` the scope's `QueryClient` (`QueryClientTag`). The client's
 * lifetime is its layer's scope (`QueryClientLive`), so each `LayerProvider` root gets its own client and it
 * is unmounted and cleared when that root's scope closes. Hooks come from `@tanstack/react-query` itself.
 */

import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { QueryClientTag } from '@sleekstack/query'
import { useService } from './useService'

/**
 * Renders TanStack's `QueryClientProvider` with the `QueryClient` from the nearest `LayerProvider`'s scope.
 * Suspends while the scope builds; a scope without `QueryClientTag` throws like {@link useService}.
 *
 * @example
 * ```tsx
 * <LayerProvider provide={[QueryClientLive()]}><QueryProvider>...</QueryProvider></LayerProvider>
 * ```
 */
export function QueryProvider({ children }: { readonly children?: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: useService(QueryClientTag) }, children)
}
