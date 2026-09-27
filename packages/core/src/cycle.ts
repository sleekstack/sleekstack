/**
 * packages/core/src/cycle.ts
 *
 * Internal DFS over the module import graph, keyed on object identity.
 * Detects identity cycles (only reachable through thunk imports) and duplicate
 * names (distinct objects sharing a name). Diamonds are not errors; every
 * import path to a module is recorded as provenance.
 */

import { DuplicateModule, InvalidModule, ModuleCycle } from './errors'
import { isModule, type Module } from './module'

export interface Visit {
  readonly module: Module
  /** Import paths (module names, root first, ending with this module). */
  readonly paths: string[][]
  /** Shortest import depth (1 = passed directly to buildGraph). */
  depth: number
}

export function walkModules(roots: readonly Module[]): Map<Module, Visit> {
  const visits = new Map<Module, Visit>()
  const byName = new Map<string, Module>()
  const onStack = new Set<Module>()

  function dfs(mod: Module, path: string[]): void {
    const here = [...path, mod.name]
    if (onStack.has(mod)) {
      const cycle = here.slice(path.indexOf(mod.name))
      throw new ModuleCycle({ path: cycle, message: `Module import cycle: ${cycle.join(' -> ')}` })
    }
    const named = byName.get(mod.name)
    if (named && named !== mod) {
      throw new DuplicateModule({
        name: mod.name,
        message: `Two distinct modules are named "${mod.name}" (reached via ${here.join(' -> ')})`,
      })
    }
    byName.set(mod.name, mod)
    const visit = visits.get(mod) ?? { module: mod, paths: [], depth: here.length }
    visit.paths.push(here)
    visit.depth = Math.min(visit.depth, here.length)
    visits.set(mod, visit)

    onStack.add(mod)
    const imports = typeof mod.imports === 'function' ? mod.imports() : mod.imports
    for (const imp of imports) {
      if (!isModule(imp)) {
        throw new InvalidModule({ name: mod.name, message: `module("${mod.name}") imports a non-module value` })
      }
      // ponytail: re-walks shared subtrees per path (all paths kept as provenance); exponential only for pathological diamond stacks
      dfs(imp, here)
    }
    onStack.delete(mod)
  }

  for (const r of roots) dfs(r, [])
  return visits
}
