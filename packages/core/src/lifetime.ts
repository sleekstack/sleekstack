/**
 * packages/core/src/lifetime.ts
 *
 * Lifetime matrix (R5): app <- app; request <- app, request; component <- app, component.
 * request <-> component never nest, so those edges are always rejected.
 */

import { CaptiveDependency } from './errors'
import type { Lifetime } from './service'

const allowed: Record<Lifetime, readonly Lifetime[]> = {
  app: ['app'],
  request: ['app', 'request'],
  component: ['app', 'component'],
}

export const canDependOn = (from: Lifetime, to: Lifetime): boolean => allowed[from].includes(to)

type Node = { readonly id: string; readonly requires: readonly string[]; readonly lifetime: Lifetime }

/** Throws CaptiveDependency on the first edge violating the matrix. Opaque nodes never appear here. */
export function checkLifetimes<N extends Node>(nodes: readonly N[], provider: (key: string) => N): void {
  for (const n of nodes) {
    for (const r of n.requires) {
      const p = provider(r)
      if (!canDependOn(n.lifetime, p.lifetime)) {
        throw new CaptiveDependency({
          service: n.id, lifetime: n.lifetime, dependency: p.id, dependencyLifetime: p.lifetime,
          message: `Service "${n.id}" (${n.lifetime}) cannot depend on "${p.id}" (${p.lifetime})`,
        })
      }
    }
  }
}
