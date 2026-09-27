/**
 * packages/core/src/order.ts
 *
 * Spike (fn-1 task .2): topological ordering over service-definition metadata
 * (Kahn), readable missing-dependency error, DependencyCycle with Tag path.
 */

import { Data, Layer } from 'effect'
import type { AnyServiceDefinition } from './service'

export class MissingDependency extends Data.TaggedError('MissingDependency')<{
  readonly service: string
  readonly missing: string
  readonly message: string
}> {}

export class DependencyCycle extends Data.TaggedError('DependencyCycle')<{
  readonly path: readonly string[]
  readonly message: string
}> {}

/** Returns definitions in construction order (dependencies first). Throws on missing deps / cycles. */
export function order<D extends AnyServiceDefinition>(defs: readonly D[]): D[] {
  const byKey = new Map(defs.map((d) => [d.tag.key, d]))
  const indegree = new Map<string, number>()
  const dependents = new Map<string, string[]>()
  for (const d of defs) {
    indegree.set(d.tag.key, d.requires.length)
    for (const r of d.requires) {
      if (!byKey.has(r.key)) {
        throw new MissingDependency({
          service: d.tag.key,
          missing: r.key,
          message: `Service "${d.tag.key}" requires "${r.key}", but no entry provides it`,
        })
      }
      dependents.set(r.key, [...(dependents.get(r.key) ?? []), d.tag.key])
    }
  }

  const queue = defs.filter((d) => d.requires.length === 0).map((d) => d.tag.key)
  const out: D[] = []
  for (let key = queue.shift(); key !== undefined; key = queue.shift()) {
    out.push(byKey.get(key)!)
    for (const dep of dependents.get(key) ?? []) {
      const n = indegree.get(dep)! - 1
      indegree.set(dep, n)
      if (n === 0) queue.push(dep)
    }
  }
  if (out.length === defs.length) return out

  // Leftover nodes all sit on or behind a cycle: walk requires edges among them until a repeat.
  const left = new Set(defs.map((d) => d.tag.key).filter((k) => indegree.get(k)! > 0))
  const path: string[] = []
  let cur = [...left][0]!
  while (!path.includes(cur)) {
    path.push(cur)
    cur = byKey.get(cur)!.requires.map((r) => r.key).find((k) => left.has(k))!
  }
  const cycle = [...path.slice(path.indexOf(cur)), cur]
  throw new DependencyCycle({ path: cycle, message: `Dependency cycle: ${cycle.join(' -> ')}` })
}

/** Composes ordered definitions into one Layer providing every service. */
export function wire(defs: readonly AnyServiceDefinition[]): Layer.Layer<any, any, never> {
  let acc = Layer.empty as unknown as Layer.Layer<any, any, any>
  for (const d of order(defs)) acc = d.layer.pipe(Layer.provideMerge(acc))
  return acc as Layer.Layer<any, any, never>
}
