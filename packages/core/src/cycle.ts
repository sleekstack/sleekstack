/**
 * packages/core/src/cycle.ts
 *
 * Internal DFS circular-dependency detection for module().
 * Not exported from @sleekstack/core — internal use only.
 */

/** Minimal structural shape needed for cycle detection — independent of the full Module type */
type ModuleConfig = { name: string; imports?: ModuleConfig[] }

/**
 * Runs a depth-first traversal of the module import graph starting at `mod`.
 * Throws synchronously if a cycle is detected, with an arrow-joined cycle trace.
 *
 * The `visiting` set tracks names currently on the DFS stack (not just visited).
 * This means a diamond (shared, non-circular import) does NOT falsely trigger —
 * a node re-visited from a different path is NOT in `visiting` when re-encountered.
 *
 * Time complexity: O(V+E) where V = unique module names, E = total import edges.
 * The visiting-set bound guarantees termination — no infinite recursion is possible.
 */
export function detectCycles(mod: ModuleConfig): void {
  const visiting = new Set<string>()

  function dfs(current: ModuleConfig, path: string[]): void {
    if (visiting.has(current.name)) {
      const i = path.indexOf(current.name)
      const cycleSlice = path.slice(i)
      const trace = [...cycleSlice, current.name].join(' -> ')
      throw new Error(`Circular module dependency detected: ${trace}`)
    }

    visiting.add(current.name)
    for (const imp of current.imports ?? []) {
      dfs(imp, [...path, current.name])
    }
    visiting.delete(current.name)
  }

  dfs(mod, [])
}
