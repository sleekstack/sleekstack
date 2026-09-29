/**
 * packages/core/src/order.ts
 *
 * Spike (fn-1 task .2): topological ordering over bare service definitions.
 * The scope runtime is the production path; this stays as the definitions-only helper.
 */

import { Layer } from 'effect'
import { MissingDependency } from './errors'
import { toposort } from './graph'
import type { AnyServiceDefinition } from './service'

export { DependencyCycle, MissingDependency } from './errors'

/** Returns definitions in construction order (dependencies first). Throws on missing deps / cycles. */
export function order<D extends AnyServiceDefinition>(defs: readonly D[]): D[] {
  const byKey = new Map(defs.map((d) => [d.tag.key, d]))
  for (const d of defs) {
    for (const r of d.requires) {
      if (!byKey.has(r.key)) {
        throw new MissingDependency({
          service: d.tag.key,
          missing: r.key,
          message: `Service "${d.tag.key}" requires "${r.key}", but no entry provides it`,
        })
      }
    }
  }
  const nodes = defs.map((def) => ({ id: def.tag.key, requires: def.requires.map((r) => r.key), def }))
  const byId = new Map(nodes.map((n) => [n.id, n]))
  return toposort(nodes, (k) => byId.get(k)!).map((n) => n.def)
}

/** Composes ordered definitions into one Layer providing every service. */
export function wire(defs: readonly AnyServiceDefinition[]): Layer.Layer<any, any, never> {
  let acc = Layer.empty as unknown as Layer.Layer<any, any, any>
  for (const d of order(defs)) acc = d.layer.pipe(Layer.provideMerge(acc))
  return acc as Layer.Layer<any, any, never>
}
