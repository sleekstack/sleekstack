/**
 * packages/analyze/src/extract.ts
 *
 * Reads kit/core graph declarations from a tsconfig project through the TypeScript checker,
 * without importing or executing any of it. Callees are identified by the declaration they
 * resolve to (so re-exports and aliases work), Tags by their `tag('Name')` / `GenericTag('Name')`
 * / `Context.Tag('Name')` declaration or, for abstract classes, the class declaration. Anything
 * that cannot be read precisely is a located error, never a silent gap.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import ts from 'typescript'
import type { AnalyzeError, Atoms, Edge, Graph, GraphNode, Lifetime, Location, ModuleDecl, ProviderDecl, Report, Shadowing } from './model'

/** Which library function a call resolves to, e.g. `kit/layer#layer`, `effect/Context#GenericTag`. */
function libId(sym: ts.Symbol | undefined, checker: ts.TypeChecker): string | undefined {
  if (!sym) return undefined
  if (sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym)
  const file = sym.declarations?.[0]?.getSourceFile().fileName.replace(/\\/g, '/')
  if (!file) return undefined
  const own = /\/(?:packages|@sleekstack)\/(kit|core)\/src\/(.+)\.ts$/.exec(file)
  if (own) return `${own[1]}/${own[2]}#${sym.name}`
  if (/\/effect\/dist\/dts\/Context\.d\.ts$/.test(file)) return `effect/Context#${sym.name}`
  return undefined
}

const TAG_CALLS = new Set(['kit/tag#tag', 'effect/Context#GenericTag'])
const MODULE_CALLS = new Set(['kit/module#makeModule', 'core/module#makeModule'])
const ATOM_CALLS = new Set(['kit/atom#atom', 'kit/atom#family'])

const unwrap = (e: ts.Expression): ts.Expression => {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isNonNullExpression(e) || ts.isTypeAssertionExpression(e)) e = e.expression
  return e
}

class Unreadable extends Error {
  constructor(readonly node: ts.Node, message: string, readonly code = 'Unresolvable') {
    super(message)
  }
}

export function extract(project: string): Report {
  const configPath = path.resolve(project)
  const root = path.dirname(configPath)
  const read = ts.readConfigFile(configPath, ts.sys.readFile)
  if (read.error) throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText, '\n'))
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, root, undefined, configPath)
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options, projectReferences: parsed.projectReferences })
  const checker = program.getTypeChecker()
  const errors: AnalyzeError[] = []

  const loc = (n: ts.Node): Location => {
    const sf = n.getSourceFile()
    return { file: path.relative(root, sf.fileName), line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 }
  }
  const fail = (n: ts.Node, message: string, code?: string): never => {
    throw new Unreadable(n, message, code)
  }
  const report = (e: unknown) => {
    if (!(e instanceof Unreadable)) throw e
    errors.push({ code: e.code, message: e.message, ...loc(e.node) })
  }
  const text = (n: ts.Node) => n.getText().replace(/\s+/g, ' ').slice(0, 80)
  const calleeOf = (c: ts.CallExpression) => libId(checker.getSymbolAtLocation(c.expression), checker)

  /** The declaration an identifier / property access stands for (through aliases). */
  const declOf = (e: ts.Expression): ts.Declaration | undefined => {
    let sym = checker.getSymbolAtLocation(e)
    if (sym && sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym)
    const d = sym?.valueDeclaration ?? sym?.declarations?.[0]
    if (d && ts.isShorthandPropertyAssignment(d)) return declOf(d.name)
    return d
  }

  /** Follows identifiers and property accesses to the expression that initializes them. */
  const follow = (expr: ts.Expression): ts.Expression | ts.ClassDeclaration => {
    const e = unwrap(expr)
    if (!ts.isIdentifier(e) && !ts.isPropertyAccessExpression(e)) return e
    const d = declOf(e)
    if (d && ts.isVariableDeclaration(d) && d.initializer) {
      // The initializer is only the value if the binding never changes: `let`/`var` or an in-place mutation is a silent gap.
      if (!(ts.getCombinedNodeFlags(d) & ts.NodeFlags.Const)) return fail(e, `"${text(e)}" is not a const binding; its value cannot be read statically`, 'Computed')
      const m = mutationOf(d)
      if (m) return fail(m, `"${text(m)}" mutates "${text(e)}"; the declaration cannot be read statically`, 'Computed')
      return follow(d.initializer)
    }
    if (d && ts.isPropertyAssignment(d)) return follow(d.initializer)
    if (d && ts.isClassDeclaration(d)) return d
    return fail(e, `Cannot resolve "${text(e)}" to a declaration`)
  }

  const MUTATORS = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'fill', 'copyWithin', 'sort', 'reverse'])
  const mutations = new Map<ts.Symbol, ts.Node | undefined>()
  /** The first write through a const binding (`x.push(..)`, `x[i] = ..`, `x.k = ..`), or undefined. */
  const mutationOf = (d: ts.VariableDeclaration): ts.Node | undefined => {
    const sym = checker.getSymbolAtLocation(d.name)
    if (!sym) return undefined
    if (mutations.has(sym)) return mutations.get(sym)
    let hit: ts.Node | undefined
    const scan = (n: ts.Node): void => {
      if (hit) return
      if (ts.isIdentifier(n) && n !== d.name && checker.getSymbolAtLocation(n) === sym) {
        const acc = n.parent
        if ((ts.isPropertyAccessExpression(acc) || ts.isElementAccessExpression(acc)) && acc.expression === n) {
          const up = acc.parent
          if (ts.isPropertyAccessExpression(acc) && MUTATORS.has(acc.name.text) && ts.isCallExpression(up) && up.expression === acc) hit = up
          else if (ts.isBinaryExpression(up) && up.left === acc && up.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && up.operatorToken.kind <= ts.SyntaxKind.LastAssignment) hit = up
          else if (ts.isDeleteExpression(up)) hit = up
        }
      }
      ts.forEachChild(n, scan)
    }
    sources.forEach(scan)
    mutations.set(sym, hit)
    return hit
  }

  const literal = (e: ts.Expression, what: string): string => {
    const t = checker.getTypeAtLocation(e)
    if (t.isStringLiteral()) return t.value
    return fail(e, `${what} must be a string literal, got "${text(e)}"`)
  }

  const lifetimeOf = (e: ts.Expression | undefined): Lifetime | undefined => {
    if (!e) return undefined
    const v = literal(e, 'lifetime')
    if (v !== 'app' && v !== 'request' && v !== 'component') return fail(e, `Unknown lifetime "${v}"`)
    return v
  }

  const objectOf = (e: ts.Expression | undefined): ts.ObjectLiteralExpression | undefined => {
    if (!e) return undefined
    const f = follow(e)
    if (ts.isObjectLiteralExpression(f)) return f
    return fail(e, `Expected an object literal, got "${text(e)}"`, 'Computed')
  }

  const prop = (o: ts.ObjectLiteralExpression | undefined, name: string): ts.Expression | undefined => {
    if (!o) return undefined
    for (const p of o.properties) {
      if (ts.isSpreadAssignment(p)) fail(p, 'Spread in a declaration object cannot be read', 'Computed')
      if (p.name && ts.isIdentifier(p.name) && p.name.text === name) {
        if (ts.isPropertyAssignment(p)) return p.initializer
        if (ts.isShorthandPropertyAssignment(p)) return p.name
      }
    }
    return undefined
  }

  /** Array literals (with spreads and conditionals over-approximated), through const bindings. */
  const listOf = (expr: ts.Expression | undefined, item: (e: ts.Expression) => void): void => {
    if (!expr) return
    const e = follow(expr)
    if (ts.isClassDeclaration(e)) return fail(expr, `Expected an array, got class "${text(expr)}"`, 'Computed')
    if (ts.isConditionalExpression(e)) return (listOf(e.whenTrue, item), listOf(e.whenFalse, item))
    if (!ts.isArrayLiteralExpression(e)) return fail(expr, `Computed list "${text(expr)}" cannot be read statically`, 'Computed')
    for (const el of e.elements) {
      if (ts.isSpreadElement(el)) listOf(el.expression, item)
      else item(el)
    }
  }

  const classKey = (c: ts.ClassDeclaration): string => {
    const ext = c.heritageClauses?.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword)?.types[0]?.expression
    // `class X extends Context.Tag('X')<X, S>() {}`: the outer call's callee is the `Context.Tag('X')` call.
    const inner = ext && ts.isCallExpression(ext) && ts.isCallExpression(ext.expression) ? ext.expression : undefined
    if (inner && calleeOf(inner) === 'effect/Context#Tag' && inner.arguments[0]) return literal(inner.arguments[0], 'Tag key')
    if (!c.name) return fail(c, 'An anonymous class cannot be a Tag')
    return c.name.text
  }

  const tagKey = (expr: ts.Expression): string => {
    const e = follow(expr)
    if (ts.isClassDeclaration(e)) return classKey(e)
    if (ts.isCallExpression(e) && TAG_CALLS.has(calleeOf(e) ?? '')) {
      if (!e.arguments[0]) return fail(e, 'tag() needs a name')
      // Located at the use site: that is where the unreadable Tag leaves the graph.
      if (!checker.getTypeAtLocation(e.arguments[0]).isStringLiteral()) return fail(expr, `Tag "${text(expr)}" has a non-literal key "${text(e.arguments[0])}"`)
      return literal(e.arguments[0], 'Tag key')
    }
    return fail(expr, `"${text(expr)}" does not resolve to a tag() declaration`)
  }

  const tagList = (e: ts.Expression | undefined): string[] => {
    const out: string[] = []
    listOf(e, (t) => out.push(tagKey(t)))
    return out
  }

  const providers = new Map<ts.Node, ProviderDecl>()
  const provider = (expr: ts.Expression, core: boolean): ProviderDecl => {
    const e = follow(expr)
    const hit = providers.get(e)
    if (hit) return hit
    let p: ProviderDecl
    const id = ts.isCallExpression(e) ? calleeOf(e) : undefined
    const a = ts.isCallExpression(e) ? e.arguments : ts.factory.createNodeArray<ts.Expression>()
    const base = { opaque: false, loc: loc(e) }
    if (id === 'kit/layer#layer') {
      p = { ...base, provides: [tagKey(a[0]!)], requires: tagList(a[2]), lifetime: lifetimeOf(prop(objectOf(a[3]), 'lifetime')) }
    } else if (id === 'kit/effect#effect') {
      const opts = objectOf(a[2])
      const name = prop(opts, 'name')
      // Runtime numbers unnamed effects in evaluation order, which the analyzer cannot reproduce.
      if (!name) return fail(e, 'effect() in a module needs a literal `name` so its graph identity is static', 'UnnamedEffect')
      p = { ...base, provides: [`effect:${literal(name, 'effect name')}`], requires: tagList(a[1]), lifetime: lifetimeOf(prop(opts, 'lifetime')) }
    } else if (id === 'core/service#service') {
      const opts = objectOf(a[1])
      p = { ...base, provides: [tagKey(a[0]!)], requires: tagList(prop(opts, 'requires')), lifetime: lifetimeOf(prop(opts, 'lifetime')) }
    } else if (id === 'core/module#declareLayer') {
      const opts = objectOf(a[1])
      p = { ...base, provides: tagList(prop(opts, 'provides')), requires: tagList(prop(opts, 'requires')), lifetime: lifetimeOf(prop(opts, 'lifetime')) }
    } else if (core && checker.getTypeAtLocation(expr).getSymbol()?.getName() === 'Layer') {
      p = { ...base, opaque: true, provides: [], requires: [], lifetime: undefined } // self-contained bare Layer
    } else {
      return fail(expr, `"${text(expr)}" is not a recognized layer() / service() / declareLayer() declaration`)
    }
    providers.set(e, p)
    return p
  }

  const modules = new Map<ts.Node, ModuleDecl>()
  const moduleOf = (expr: ts.Expression): ModuleDecl => {
    const e = follow(expr)
    const hit = modules.get(e)
    if (hit) return hit
    const id = ts.isCallExpression(e) ? calleeOf(e) : undefined
    if (!ts.isCallExpression(e) || !MODULE_CALLS.has(id!)) return fail(expr, `"${text(expr)}" does not resolve to a module() declaration`)
    const core = id === 'core/module#makeModule'
    const cfg = objectOf(e.arguments[0])
    const nameExpr = prop(cfg, 'name')
    const m: ModuleDecl = { name: nameExpr ? literal(nameExpr, 'module name') : fail(e, 'module() needs a name'), entries: [], imports: [], exports: undefined, lifetime: undefined, loc: loc(e) }
    modules.set(e, m) // before imports: thunk cycles terminate
    // Each field reports independently, so one unreadable list does not hide the others.
    const field = (f: () => void) => { try { f() } catch (err) { report(err) } }
    field(() => listOf(prop(cfg, core ? 'entries' : 'provide'), (x) => { try { m.entries.push(provider(x, core)) } catch (err) { report(err) } }))
    field(() => {
      let imp = prop(cfg, 'imports')
      const th = imp && unwrap(imp)
      if (th && (ts.isArrowFunction(th) || ts.isFunctionExpression(th))) {
        const ret = ts.isBlock(th.body) ? th.body.statements.find(ts.isReturnStatement)?.expression : th.body
        imp = ret ?? fail(th, 'imports thunk must return an array')
      }
      listOf(imp, (x) => { try { m.imports.push(moduleOf(x)) } catch (err) { report(err) } })
    })
    field(() => { const x = prop(cfg, 'exports'); if (x) m.exports = tagList(x) })
    if (core) field(() => { m.lifetime = lifetimeOf(prop(cfg, 'lifetime')) })
    return m
  }

  // Emitted `.js` / `.d.ts` next to a `.ts` source shadows it: refuse rather than analyze stale output.
  const sources: ts.SourceFile[] = []
  for (const sf of program.getSourceFiles()) {
    if (/[\\/]node_modules[\\/]/.test(sf.fileName)) continue
    const stem = sf.fileName.replace(/(\.d)?\.(ts|tsx|js|jsx|mjs|cjs)$/, '')
    if (/\.(d\.ts|js|jsx)$/.test(sf.fileName) && ['.ts', '.tsx'].some((x) => fs.existsSync(stem + x))) {
      errors.push({ code: 'EmittedSibling', message: `${path.relative(root, sf.fileName)} is emitted output next to its .ts source; delete it`, file: path.relative(root, sf.fileName), line: 1 })
      continue
    }
    if (!sf.isDeclarationFile && program.getRootFileNames().includes(sf.fileName)) sources.push(sf)
  }

  const found: ModuleDecl[] = []
  const atomNodes: Atoms['nodes'][number][] = []
  const atomEdges: Edge[] = []
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n)) {
      const id = calleeOf(n)
      if (id && MODULE_CALLS.has(id)) {
        try { found.push(moduleOf(n)) } catch (err) { report(err) }
      } else if (id && ATOM_CALLS.has(id) && n.arguments[0] && (id === 'kit/atom#family' || n.arguments.length > 1 || checker.getTypeAtLocation(n.arguments[0]).getCallSignatures().length > 0)) {
        try {
          const requires = tagList(n.arguments[1])
          const v = ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name) ? n.parent.name.text : undefined
          const l = loc(n)
          const aid = `atom:${v ?? `${l.file}:${l.line}`}`
          atomNodes.push({ id: aid, ...l })
          for (const t of requires) atomEdges.push({ from: aid, to: t, tag: t })
        } catch (err) { report(err) }
      }
    }
    ts.forEachChild(n, visit)
  }
  sources.forEach(visit)

  const imported = new Set(found.flatMap((m) => m.imports))
  const roots = [...new Set(found)].filter((m) => !imported.has(m))
  return { graphs: roots.map(graphOf), atoms: { nodes: atomNodes, edges: atomEdges }, errors }
}

/** Mirrors core `resolveEntries` + `snapshot`: module walk, per-Tag shadowing by locality, one node per provided Tag. */
export function graphOf(rootModule: ModuleDecl): Graph {
  type Visit = { paths: string[][]; depth: number }
  const visits = new Map<ModuleDecl, Visit>()
  const onStack = new Set<ModuleDecl>()
  const dfs = (m: ModuleDecl, trail: string[]) => {
    if (onStack.has(m)) return // ModuleCycle: reported by validation, not extraction
    const here = [...trail, m.name]
    const v = visits.get(m) ?? { paths: [], depth: here.length }
    v.paths.push(here)
    v.depth = Math.min(v.depth, here.length)
    visits.set(m, v)
    onStack.add(m)
    m.imports.forEach((i) => dfs(i, here))
    onStack.delete(m)
  }
  dfs(rootModule, [])

  type Seen = { p: ProviderDecl; module: ModuleDecl; depth: number; paths: string[][] }
  const seen = new Map<ProviderDecl, Seen>()
  for (const [module, v] of visits) {
    for (const p of module.entries) {
      const prev = seen.get(p)
      if (!prev) seen.set(p, { p, module, depth: v.depth, paths: [...v.paths] })
      else {
        prev.paths.push(...v.paths)
        if (v.depth < prev.depth) Object.assign(prev, { module, depth: v.depth })
      }
    }
  }

  const isPrivate = (m: ModuleDecl, key: string) => m.exports !== undefined && !m.exports.includes(key)
  const all = [...seen.values()]
  const byTag = new Map<string, Seen[]>()
  for (const s of all) for (const k of s.p.provides) byTag.set(k, [...(byTag.get(k) ?? []), s])
  const won = new Map<string, Seen>()
  const shadowing: Shadowing[] = []
  const shadowedId = (tag: string, s: Seen) => `${tag}@${s.module.name}`
  for (const [tag, ss] of byTag) {
    const best = Math.min(...ss.map((s) => s.depth))
    const winner = ss.find((s) => s.depth === best)! // AmbiguousProvider at equal depth: validation's to report
    won.set(tag, winner)
    const losers = ss.filter((s) => s !== winner)
    if (losers.length) shadowing.push({ tag, winner: tag, shadowed: losers.map((s) => shadowedId(tag, s)) })
  }

  let opaqueN = 0
  const nodes: GraphNode[] = []
  const edges: Edge[] = []
  for (const s of all) {
    const base = {
      lifetime: s.p.lifetime ?? s.module.lifetime ?? 'app',
      module: { id: s.module.name, name: s.module.name },
      paths: s.paths.map((p) => [...p]),
      opaque: s.p.opaque,
    }
    if (s.p.opaque) {
      const id = `opaque:${s.module.name}#${opaqueN++}`
      nodes.push({ ...base, id, name: id, provides: [], private: true, shadowed: false })
      continue
    }
    const mine = s.p.provides.filter((k) => won.get(k) === s)
    for (const k of s.p.provides) {
      const shadowed = !mine.includes(k)
      nodes.push({ ...base, id: shadowed ? shadowedId(k, s) : k, name: k, provides: [k], private: isPrivate(s.module, k), shadowed })
    }
    for (const from of mine) for (const tag of s.p.requires) edges.push({ from, to: tag, tag })
  }

  return {
    root: rootModule.name,
    nodes,
    edges,
    shadowing,
    modules: [...visits.keys()].map((m) => ({ name: m.name, imports: m.imports.map((i) => i.name), exports: m.exports ? [...m.exports] : null, ...m.loc })),
    private: nodes.filter((n) => n.private).map((n) => n.id),
  }
}
