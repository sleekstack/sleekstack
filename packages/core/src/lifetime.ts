/**
 * packages/core/src/lifetime.ts
 *
 * Lifetime matrix (R5): app <- app; request <- app, request; component <- app, component.
 * request <-> component never nest, so those edges are always rejected.
 */

import type { Lifetime } from './service'

const allowed: Record<Lifetime, readonly Lifetime[]> = {
  app: ['app'],
  request: ['app', 'request'],
  component: ['app', 'component'],
}

/**
 * Whether a service of lifetime `from` may depend on one of lifetime `to`
 * (app on app; request on app/request; component on app/component).
 *
 * @param from - The dependent's lifetime.
 * @param to - The dependency's lifetime.
 * @returns `true` when the edge is allowed.
 *
 * @example
 * ```ts
 * import { canDependOn } from '@sleekstack/core'
 *
 * canDependOn('request', 'app') // true
 * canDependOn('app', 'request') // false
 * ```
 */
export const canDependOn = (from: Lifetime, to: Lifetime): boolean => allowed[from].includes(to)
