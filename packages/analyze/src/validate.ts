/**
 * packages/analyze/src/validate.ts
 *
 * The whole-graph checks of core `buildGraph` / `walkModules`, ported to the static model: same
 * error codes and messages, but every violation is reported (located at its declaration) instead
 * of throwing on the first.
 */

import { isPrivate, resolve, type Seen } from './extract'
import type { ActionDecl, AnalyzeError, Lifetime, Location, ModuleDecl } from './model'

const allowed: Record<Lifetime, readonly Lifetime[]> = { app: ['app'], request: ['app', 'request'], component: ['app', 'component'] }

export function validate(root: ModuleDecl): AnalyzeError[] {
  const errors: AnalyzeError[] = []
  const err = (code: string, message: string, at: Location) => errors.push({ code, message, file: at.file, line: at.line })

  // Module walk (core cycle.ts): identity cycles and distinct modules sharing a name.
  const byName = new Map<string, ModuleDecl>()
  const onStack = new Set<ModuleDecl>()
  const done = new Set<ModuleDecl>()
  const walk = (m: ModuleDecl, trail: string[]) => {
    const here = [...trail, m.name]
    if (onStack.has(m)) {
      const cycle = here.slice(trail.indexOf(m.name))
      return void err('ModuleCycle', `Module import cycle: ${cycle.join(' -> ')}`, m.loc)
    }
    const named = byName.get(m.name)
    if (named && named !== m) return void err('DuplicateModule', `Two distinct modules are named "${m.name}" (reached via ${here.join(' -> ')})`, m.loc)
    byName.set(m.name, m)
    if (done.has(m)) return // diamond: already checked below
    onStack.add(m)
    m.imports.forEach((i) => walk(i, here))
    onStack.delete(m)
    done.add(m)
  }
  walk(root, [])

  const { all, byTag, won } = resolve(root)
  const where = (s: Seen) => `module "${s.module.name}"`
  const lifetime = (s: Seen) => s.p.lifetime ?? s.module.lifetime ?? 'app'

  // Core stops at AmbiguousProvider; here its Tags have no owner, so nothing downstream judges through them.
  const ambiguous = new Set<string>()
  for (const [tag, ss] of byTag) {
    const best = Math.min(...ss.map((s) => s.depth))
    const top = ss.filter((s) => s.depth === best)
    if (top.length > 1) ambiguous.add(tag)
    if (top.length > 1) err('AmbiguousProvider', `Tag "${tag}" is provided by several entries at the same precedence: ${top.map(where).join(', ')}`, top[1]!.p.loc)
  }

  // Live providers: non-opaque, winning at least one Tag. Their id is core's (`A+B` for a declared Layer).
  const live = all.filter((s) => !s.p.opaque && s.p.provides.some((k) => won.get(k) === s))
  const id = (s: Seen) => s.p.provides.join('+') // core keeps a partially shadowed layer's full id
  for (const s of live) {
    for (const r of s.p.requires) {
      if (ambiguous.has(r)) continue
      const owner = won.get(r)
      if (!owner) {
        err('MissingDependency',
          `Service "${id(s)}" (${where(s)}) requires "${r}", but no entry provides it. ` +
          `If a raw Layer provides it, wrap it with declareLayer(layer, { provides: [...] }).`, s.p.loc)
      } else if (owner.module !== s.module && isPrivate(owner.module, r)) {
        err('PrivateDependency', `"${id(s)}" requires "${r}", which is private to module "${owner.module.name}" (not in its exports)`, s.p.loc)
      } else if (!allowed[lifetime(s)].includes(lifetime(owner))) {
        err('CaptiveDependency', `Service "${id(s)}" (${lifetime(s)}) cannot depend on "${id(owner)}" (${lifetime(owner)})`, s.p.loc)
      }
    }
  }

  // Service cycles (core toposort): report each cycle once, at the provider where the DFS closes it.
  const state = new Map<Seen, 'active' | 'done'>()
  const dfs = (s: Seen, stack: Seen[]) => {
    state.set(s, 'active')
    stack.push(s)
    for (const r of s.p.requires) {
      const d = won.get(r)
      if (!d || d.p.opaque || ambiguous.has(r)) continue
      if (state.get(d) === 'active') {
        const cycle = [...stack.slice(stack.indexOf(d)), d].map(id)
        err('DependencyCycle', `Dependency cycle: ${cycle.join(' -> ')}`, s.p.loc)
      } else if (!state.has(d)) dfs(d, stack)
    }
    stack.pop()
    state.set(s, 'done')
  }
  for (const s of live) if (!state.has(s)) dfs(s, [])
  return errors
}

/**
 * An action's yielded Tags against one runtime root overlaid with its `opts.provide` (which Shadows the root):
 * each must be provided and visible, and the overlay's own layers must have their dependencies met.
 */
export function validateAction(runtime: ModuleDecl, a: ActionDecl): AnalyzeError[] {
  const root: ModuleDecl = { ...a.provide, imports: [...a.provide.imports, runtime] }
  const { won } = resolve(root)
  // The overlay's own errors: whatever validating it adds beyond the runtime's (its layers and provided modules).
  const key = (e: AnalyzeError) => `${e.code}|${e.file}:${e.line}|${e.message}`
  const base = new Set(validate(runtime).map(key))
  const overlay = a.provide.entries.length || a.provide.imports.length ? validate(root).filter((e) => !base.has(key(e))) : []
  return [...overlay, ...a.yields.flatMap(({ tag, loc }): AnalyzeError[] => {
    const owner = won.get(tag)
    if (!owner) return [{ code: 'MissingDependency', message: `The action yields "${tag}", but no entry provides it`, ...loc }]
    if (owner.module !== root && owner.module !== runtime && isPrivate(owner.module, tag)) return [{ code: 'PrivateDependency', message: `The action yields "${tag}", which is private to module "${owner.module.name}" (not in its exports)`, ...loc }]
    return []
  })]
}
