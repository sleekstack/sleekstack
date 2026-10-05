/**
 * packages/core/src/graph.ts
 *
 * Position order, not a graph: entries of every reachable module (identity walk, each module once) are
 * flattened deepest import first, then importers, then root entries. Building them in that order over one
 * growing context makes a later (more local) Layer override an earlier one. Everything that needs the
 * whole graph (missing, cycle, captive, private, ambiguous) is the analyzer's (`sleekstack check`).
 */

import { Cause, Layer } from 'effect'
import { isDeclaredLayer, isModule, type Entry, type Module } from './module'
import type { Lifetime } from './lifetime'

type AnyLayer = Layer.Layer<any, any, any>

/** One entry in build order. */
export interface PlanNode {
  readonly lifetime: Lifetime
  readonly module: Module | undefined
  readonly layer: AnyLayer
}

/** Raw-Layer construction failures carry the owning module's name; the original Cause is kept as `cause`. */
const attributed = (layer: AnyLayer, module: Module | undefined): AnyLayer =>
  module === undefined
    ? layer
    : Layer.catchAllCause(layer, (cause) =>
        Layer.failCause(
          Cause.die(
            new Error(`Raw Layer in module "${module.name}" failed to build: ${Cause.squash(cause)}`, { cause }),
          ),
        ),
      )

/** Entries of `input` in build order. A module's longest import path decides its depth; a thunk that throws is skipped. */
export function flatten(input: readonly (Module | Entry)[]): PlanNode[] {
  const depth = new Map<Module, number>()
  const onStack = new Set<Module>()
  const walk = (m: Module, d: number): void => {
    if (onStack.has(m) || (depth.get(m) ?? 0) >= d) return // cycles are the analyzer's to report
    depth.set(m, d)
    onStack.add(m)
    try {
      const imports = typeof m.imports === 'function' ? m.imports() : m.imports
      for (const i of imports) if (isModule(i)) walk(i, d + 1)
    } catch {
      // a thunk not yet resolvable contributes nothing
    }
    onStack.delete(m)
  }
  for (const x of input) if (isModule(x)) walk(x, 1)

  const seen = new Map<Entry, { node: PlanNode; depth: number }>()
  const add = (entry: Entry, module: Module | undefined, d: number) => {
    const prev = seen.get(entry) // diamond: the same entry object builds once, at its deepest position
    if (prev && prev.depth >= d) return
    const layer = isDeclaredLayer(entry) ? entry.layer : (entry as AnyLayer)
    seen.set(entry, {
      depth: d,
      node: {
        module,
        lifetime: (isDeclaredLayer(entry) && entry.lifetime) || module?.lifetime || 'app',
        layer: isDeclaredLayer(entry) && entry.attribute === false ? layer : attributed(layer, module),
      },
    })
  }
  for (const x of input) if (!isModule(x)) add(x, undefined, 0)
  for (const [m, d] of depth) for (const e of m.entries) add(e, m, d)
  return [...seen.values()].sort((a, b) => b.depth - a.depth).map((s) => s.node) // stable
}
