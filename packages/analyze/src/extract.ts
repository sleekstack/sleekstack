/**
 * packages/analyze/src/extract.ts
 *
 * Reads core modules, plain Layers and runtime roots from a tsconfig project through the TypeScript
 * checker, without importing or executing any of it. Callees are identified by the declaration they
 * resolve to (so re-exports and aliases work), Tags by their `GenericTag('Name')` / `Context.Tag('Name')`
 * declaration or, for abstract classes, the class declaration. Anything that cannot be read precisely
 * is a located error, never a silent gap.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import ts from 'typescript'
import { validate } from './validate'
import { analyzeError } from './errorCodes'
import { checkRoot, RUNTIME_RUN_CALLS, runEffectRoots, type ExtraRoot } from './runtimeRoots'
import type {
  AnalyzeCode,
  AnalyzeError,
  Atoms,
  Edge,
  Graph,
  GraphNode,
  Lifetime,
  Location,
  ModuleDecl,
  ProviderDecl,
  Report,
  Shadowing,
} from './model'

/** Which library function a call resolves to, e.g. `core/module#declareLayer`, `effect/Context#GenericTag`. */
export function libId(sym: ts.Symbol | undefined, checker: ts.TypeChecker): string | undefined {
  if (!sym) return undefined
  if (sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym)
  const file = sym.declarations?.[0]?.getSourceFile().fileName.replace(/\\/g, '/')
  if (!file) return undefined
  const own = /\/(?:packages|@sleekstack)\/(core|runtime|query|ui|router)\/(?:src|dist)\/(.+?)(?:\.d)?\.tsx?$/.exec(
    file,
  )
  if (own) return `${own[1]}/${own[2]}#${sym.name}`
  if (/\/effect\/dist\/dts\/Context\.d\.ts$/.test(file)) return `effect/Context#${sym.name}`
  if (/\/effect\/dist\/dts\/Effect\.d\.ts$/.test(file)) return `effect/Effect#${sym.name}`
  if (/\/effect\/dist\/dts\/Layer\.d\.ts$/.test(file)) return `effect/Layer#${sym.name}`
  if (/\/effect\/dist\/dts\/Stream\.d\.ts$/.test(file)) return `effect/Stream#${sym.name}`
  return undefined
}

const TAG_CALL = 'effect/Context#GenericTag'
/** `class X extends <call>('X')<X, S>() {}`: both spell a Tag class, `Effect.Tag` adding static accessors. */
const TAG_CLASS_CALLS = new Set(['effect/Context#Tag', 'effect/Effect#Tag'])
const MODULE_CALL = 'core/module#makeModule'
const ATOM_CALL = 'core/atom/Atom#make'
const RUNTIME_CALLS = new Set(['runtime/runtime#configureRuntime'])
/** Plain Layer combinators walked structurally (data-first or as `.pipe` steps). */
const LAYER_COMBINATORS = new Set([
  'effect/Layer#mergeAll',
  'effect/Layer#merge',
  'effect/Layer#provide',
  'effect/Layer#provideMerge',
])
export const TEST_FILE = /(^|[\\/])__tests__[\\/]|\.(test|spec)\.[cm]?[jt]sx?$/

export const unwrap = (e: ts.Expression): ts.Expression => {
  while (
    ts.isParenthesizedExpression(e) ||
    ts.isAsExpression(e) ||
    ts.isSatisfiesExpression(e) ||
    ts.isNonNullExpression(e) ||
    ts.isTypeAssertionExpression(e)
  )
    e = e.expression
  return e
}

export class Unreadable extends Error {
  constructor(
    readonly node: ts.Node,
    message: string,
    readonly code: AnalyzeCode = 'Unresolvable',
  ) {
    super(message)
  }
}

/** A loop / callback variable met without a binding: `each` retries with it bound to every member of `source`. */
class Unbound {
  constructor(
    readonly decl: ts.Declaration,
    readonly source: ts.Expression,
  ) {}
}

const ITERATORS = new Set(['map', 'flatMap', 'filter', 'forEach', 'some', 'every', 'find', 'findIndex'])

/** The list a `for (const x of list)` variable or an `list.map((x) => ...)` parameter ranges over. */
const iterSource = (d: ts.Declaration): ts.Expression | undefined => {
  if (ts.isVariableDeclaration(d) && ts.isVariableDeclarationList(d.parent) && ts.isForOfStatement(d.parent.parent))
    return d.parent.parent.expression
  if (!ts.isParameter(d) || d.parent.parameters[0] !== d) return undefined
  const fn = d.parent
  const call = fn.parent
  if (
    !(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) ||
    !ts.isCallExpression(call) ||
    call.arguments[0] !== fn
  )
    return undefined
  return ts.isPropertyAccessExpression(call.expression) && ITERATORS.has(call.expression.name.text)
    ? call.expression.expression
    : undefined
}

/** The expressions a function body can return (nested functions excluded). */
export const bodyReturns = (fn: ts.FunctionLikeDeclaration): ts.Expression[] => {
  if (!fn.body) return []
  if (!ts.isBlock(fn.body)) return [fn.body]
  const out: ts.Expression[] = []
  const walk = (n: ts.Node): void => {
    if (ts.isFunctionLike(n)) return
    if (ts.isReturnStatement(n) && n.expression) out.push(n.expression)
    ts.forEachChild(n, walk)
  }
  fn.body.statements.forEach(walk)
  return out
}

/** The tsconfig project at `project` as a program and checker; `root` is the tsconfig's directory. */
export function programOf(project: string) {
  const configPath = path.resolve(project)
  const root = path.dirname(configPath)
  const read = ts.readConfigFile(configPath, ts.sys.readFile)
  if (read.error) throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText, '\n'))
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, root, undefined, configPath)
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
    projectReferences: parsed.projectReferences,
  })
  return { root, program, checker: program.getTypeChecker() }
}

export function extract(project: string, entries?: readonly string[], lenient = false): Report {
  const { root, program, checker } = programOf(project)
  const errors: AnalyzeError[] = []
  /** Loop / callback variables bound to one member of their source list (see `each`). */
  const env = new Map<ts.Declaration, ts.Expression>()
  /**
   * The evaluation instance of each active scope: a helper invocation, a mapper callback iteration, a for-of
   * iteration. A declaration inside the scope is a fresh object per instance (see `cacheKey`).
   */
  const scopes = new Map<ts.Node, string>()
  const within = <T>(scope: ts.Node, inst: string, run: () => T): T => {
    const prev = scopes.get(scope)
    scopes.set(scope, inst)
    try {
      return run()
    } finally {
      prev === undefined ? scopes.delete(scope) : scopes.set(scope, prev)
    }
  }
  /** Expands one local helper call: parameters bound to its arguments, inside its own invocation scope. */
  const invoke = (call: ts.CallExpression, fn: ts.FunctionLikeDeclaration, run: (r: ts.Expression) => void) => {
    const bound = fn.parameters
      .map((p, i) => [p, call.arguments[i]] as const)
      .filter((b): b is readonly [ts.ParameterDeclaration, ts.Expression] => !!b[1])
    const prev = bound.map(([p]) => env.get(p))
    bound.forEach(([p, a]) => env.set(p, a))
    try {
      within(fn, `@${cacheKey(call)}`, () => bodyReturns(fn).forEach(run))
    } finally {
      bound.forEach(([p], i) => (prev[i] ? env.set(p, prev[i]!) : env.delete(p)))
    }
  }
  /** Runs `run` once per iteration of every for-of loop enclosing a write (outermost first): each writes a fresh value. */
  const inLoops = (n: ts.Node, run: () => void): void => {
    const loops: ts.ForOfStatement[] = []
    for (let x: ts.Node = n; !ts.isSourceFile(x) && !ts.isFunctionLike(x); x = x.parent)
      if (ts.isForOfStatement(x) && x.statement.pos <= n.pos) loops.unshift(x)
    const go = (i: number): void => {
      const loop = loops[i]
      if (!loop) return run()
      const v = ts.isVariableDeclarationList(loop.initializer) ? loop.initializer.declarations[0] : undefined
      const key = cacheKey(loop)
      let k = 0
      listOf(loop.expression, (x) => {
        if (v) env.set(v, x)
        try {
          within(loop, `${key}#${k++}`, () => go(i + 1))
        } finally {
          if (v) env.delete(v)
        }
      })
    }
    go(0)
  }
  const localCall = (e: ts.Expression) => {
    const u = unwrap(e)
    const fn = ts.isCallExpression(u) && !calleeOf(u) ? fnOf(u.expression) : undefined
    return fn && ([u as ts.CallExpression, fn] as const)
  }

  const loc = (n: ts.Node): Location => {
    const sf = n.getSourceFile()
    const start = sf.getLineAndCharacterOfPosition(n.getStart(sf))
    const end = sf.getLineAndCharacterOfPosition(n.getEnd())
    return {
      file: path.relative(root, sf.fileName),
      line: start.line + 1,
      column: start.character + 1,
      endLine: end.line + 1,
      endColumn: end.character + 1,
    }
  }
  const fail = (n: ts.Node, message: string, code?: AnalyzeCode): never => {
    throw new Unreadable(n, message, code)
  }
  /** Unreadable-declaration errors by the module (or runtime root) whose declaration holds them. */
  const owned = new Map<ModuleDecl, AnalyzeError[]>()
  const report = (e: unknown, owner?: ModuleDecl) => {
    if (e instanceof Unbound)
      e = new Unreadable(e.source, `A loop variable over "${text(e.source)}" is used outside a list`, 'Computed')
    if (!(e instanceof Unreadable)) throw e
    const err = analyzeError(e.code, e.message, loc(e.node))
    errors.push(err)
    if (owner) owned.set(owner, [...(owned.get(owner) ?? []), err])
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
    if (ts.isIdentifier(e) && e.text === 'undefined') return e // a value, not a binding to follow
    const d = declOf(e)
    const bound = d && env.get(d)
    if (bound) return follow(bound)
    const src = d && iterSource(d)
    if (src) throw new Unbound(d!, src)
    if (d && ts.isVariableDeclaration(d) && d.initializer) {
      // The initializer is only the value if the binding never changes: `let`/`var` or an in-place mutation is a silent gap.
      if (!(ts.getCombinedNodeFlags(d) & ts.NodeFlags.Const))
        return fail(e, `"${text(e)}" is not a const binding; its value cannot be read statically`, 'Computed')
      const w = writesOf(d)
      if (w.escape)
        return fail(
          w.escape,
          `"${text(e)}" escapes at "${text(w.escape)}"; writes through it cannot be tracked`,
          'Computed',
        )
      return follow(d.initializer)
    }
    if (d && ts.isPropertyAssignment(d)) return follow(d.initializer)
    if (d && ts.isClassDeclaration(d)) return d
    return fail(e, `Cannot resolve "${text(e)}" to a declaration`)
  }

  type Writes = { added: ts.Expression[]; escape: ts.Node | undefined }
  const writes = new Map<ts.Symbol, Writes>()
  /**
   * Every value written into a const array binding after its initializer (`push`/`unshift`/`splice`/`fill` args,
   * `x[i] = v`), over-approximating; removals and reorders only shrink the set. Any other use that could let the
   * array be written elsewhere (passed to a call, aliased, returned) is an escape: fail closed.
   */
  const writesOf = (d: ts.VariableDeclaration): Writes => {
    const sym = checker.getSymbolAtLocation(d.name)
    const w: Writes = { added: [], escape: undefined }
    const t = sym && checker.getTypeOfSymbolAtLocation(sym, d.name)
    if (!t || !(checker.isArrayType(t) || checker.isTupleType(t))) return w // only lists hold members that writes can add
    const hit = writes.get(sym)
    if (hit) return hit
    writes.set(sym, w)
    const scan = (n: ts.Node): void => {
      if (w.escape) return
      if (ts.isIdentifier(n) && n !== d.name && checker.getSymbolAtLocation(n) === sym) use(n)
      ts.forEachChild(n, scan)
    }
    const use = (n: ts.Identifier) => {
      let at: ts.Node = n
      while (
        ts.isParenthesizedExpression(at.parent) ||
        ts.isAsExpression(at.parent) ||
        ts.isSatisfiesExpression(at.parent) ||
        ts.isNonNullExpression(at.parent)
      )
        at = at.parent
      const up = at.parent
      if (ts.isPropertyAccessExpression(up) && up.expression === at) {
        const call = up.parent
        const m = up.name.text
        if (ts.isCallExpression(call) && call.expression === up) {
          if (m === 'push' || m === 'unshift') w.added.push(...call.arguments)
          else if (m === 'splice') w.added.push(...call.arguments.slice(2))
          else if (m === 'fill') w.added.push(...call.arguments.slice(0, 1))
          else if (
            ![
              'pop',
              'shift',
              'sort',
              'reverse',
              'copyWithin',
              'map',
              'flatMap',
              'filter',
              'forEach',
              'slice',
              'concat',
              'includes',
              'indexOf',
              'find',
              'some',
              'every',
              'at',
              'join',
            ].includes(m)
          )
            w.escape = call
          return
        }
        if (ts.isBinaryExpression(call) && call.left === up && isAssign(call)) {
          if (m !== 'length') w.escape = call
        }
        return
      }
      if (ts.isElementAccessExpression(up) && up.expression === at) {
        const a = up.parent
        if (ts.isBinaryExpression(a) && a.left === up && isAssign(a)) w.added.push(a.right)
        return
      }
      if (ts.isSpreadElement(up) || ts.isSpreadAssignment(up) || ts.isForOfStatement(up) || ts.isTypeQueryNode(up))
        return
      // A module-config field (`provide: xs`) is a read; the analyzer follows it back here.
      if ((ts.isPropertyAssignment(up) && up.initializer === at) || ts.isShorthandPropertyAssignment(up)) return
      if (ts.isExportSpecifier(up) || ts.isImportSpecifier(up)) return
      w.escape = up
    }
    sources.forEach(scan)
    return w
  }
  const isAssign = (b: ts.BinaryExpression) =>
    b.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && b.operatorToken.kind <= ts.SyntaxKind.LastAssignment

  const literal = (e: ts.Expression, what: string): string => {
    const u = unwrap(e)
    const b = ts.isIdentifier(u) ? env.get(declOf(u)!) : undefined
    if (b) return literal(b, what) // a loop / parameter binding's own value, not its widened type
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
  const isImprecise = (e: ts.Expression) => {
    const t = checker.getTypeAtLocation(e)
    if (t.flags & ts.TypeFlags.Any) return true
    const el = checker.isArrayType(t) ? checker.getTypeArguments(t as ts.TypeReference)[0] : undefined
    if (!el) return false
    if (el.flags & ts.TypeFlags.Any) return true
    // A widened `Layer<any>[]`: the element names no Tag.
    const args =
      el.aliasTypeArguments ??
      (el.flags & ts.TypeFlags.Object && (el as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference
        ? checker.getTypeArguments(el as ts.TypeReference)
        : [])
    return el.getSymbol()?.getName() === 'Layer' && args.some((a) => !!(a.flags & ts.TypeFlags.Any))
  }

  /**
   * Calls `f(e)`; when `e` reads an unbound loop / callback variable, retries once per member of the list it
   * ranges over (over-approximating: every iteration is assumed to run).
   */
  const each = (e: ts.Expression, f: (e: ts.Expression) => void): void => {
    const u = unwrap(e)
    if (ts.isConditionalExpression(u)) return (each(u.whenTrue, f), each(u.whenFalse, f))
    const lc = localCall(u)
    if (lc && !checker.isArrayLikeType(checker.getTypeAtLocation(u))) return invoke(lc[0], lc[1], (r) => each(r, f))
    try {
      f(e)
    } catch (err) {
      if (!(err instanceof Unbound)) throw err
      const loop = err.decl.parent.parent // ForOfStatement, or the callback of an iterator method
      const key = cacheKey(loop)
      let i = 0
      listOf(err.source, (v) => {
        env.set(err.decl, v)
        try {
          within(loop, `${key}#${i++}`, () => each(e, f))
        } finally {
          env.delete(err.decl)
        }
      })
    }
  }

  /** The function a callee / callback identifier names, if it is a local function. */
  const fnOf = (e: ts.Expression): ts.FunctionLikeDeclaration | undefined => {
    let d: ts.Node | undefined = declOf(e)
    if (d && ts.isVariableDeclaration(d) && d.initializer) d = unwrap(d.initializer)
    return d && (ts.isFunctionDeclaration(d) || ts.isArrowFunction(d) || ts.isFunctionExpression(d)) && d.body
      ? d
      : undefined
  }

  /**
   * Every member a list can hold: array literals (spreads, conditionals, local helper returns, and later writes
   * through a const binding over-approximated), through const bindings. `any` / `any[]` fails closed.
   */
  const listOf = (expr: ts.Expression | undefined, item: (e: ts.Expression) => void): void => {
    if (!expr) return
    if (isImprecise(expr))
      return fail(
        expr,
        `"${text(expr)}" is typed imprecisely (any or Layer<any>); its members cannot be named`,
        'Computed',
      )
    const e = follow(expr)
    const u = unwrap(expr)
    const d = (ts.isIdentifier(u) || ts.isPropertyAccessExpression(u)) && declOf(u)
    if (d && ts.isVariableDeclaration(d))
      for (const a of writesOf(d).added)
        inLoops(a, () => (ts.isSpreadElement(a) ? each(a.expression, (x) => listOf(x, item)) : each(a, item)))
    if (ts.isClassDeclaration(e)) return fail(expr, `Expected an array, got class "${text(expr)}"`, 'Computed')
    if (ts.isConditionalExpression(e)) return (listOf(e.whenTrue, item), listOf(e.whenFalse, item))
    if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) && !calleeOf(e)) {
      const m = e.expression.name.text
      const cb = e.arguments[0] && unwrap(e.arguments[0])
      if (m === 'filter') return listOf(e.expression.expression, item)
      const fn = cb && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb) ? cb : fnOf(cb))
      if ((m === 'map' || m === 'flatMap') && fn) {
        const p = fn.parameters[0]
        const body = () => {
          for (const r of bodyReturns(fn)) m === 'map' ? each(r, item) : each(r, (x) => listOf(x, item))
        }
        const key = cacheKey(e)
        let i = 0
        return listOf(e.expression.expression, (v) => {
          if (p) env.set(p, v)
          try {
            within(fn, `${key}#${i++}`, body)
          } finally {
            if (p) env.delete(p)
          }
        })
      }
    }
    if (
      ts.isCallExpression(e) &&
      ts.isPropertyAccessExpression(e.expression) &&
      !calleeOf(e) &&
      ['slice', 'concat'].includes(e.expression.name.text)
    ) {
      listOf(e.expression.expression, item)
      for (const a of e.arguments)
        checker.isArrayLikeType(checker.getTypeAtLocation(a)) ? listOf(a, item) : each(a, item)
      return
    }
    const lc = localCall(e)
    if (lc) return invoke(lc[0], lc[1], (r) => listOf(r, item))
    if (!ts.isArrayLiteralExpression(e))
      return fail(expr, `Computed list "${text(expr)}" cannot be read statically`, 'Computed')
    for (const el of e.elements) {
      if (ts.isSpreadElement(el)) each(el.expression, (x) => listOf(x, item))
      else each(el, item)
    }
  }

  const classKey = (c: ts.ClassDeclaration): string => {
    const ext = c.heritageClauses?.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword)?.types[0]?.expression
    // `class X extends Context.Tag('X')<X, S>() {}` (or `Effect.Tag`): the outer call's callee is the `Context.Tag('X')` call.
    const inner = ext && ts.isCallExpression(ext) && ts.isCallExpression(ext.expression) ? ext.expression : undefined
    if (inner && TAG_CLASS_CALLS.has(calleeOf(inner) ?? '') && inner.arguments[0])
      return literal(inner.arguments[0], 'Tag key')
    if (!c.name) return fail(c, 'An anonymous class cannot be a Tag')
    return c.name.text
  }

  const tagKey = (expr: ts.Expression): string => {
    const e = follow(expr)
    if (ts.isClassDeclaration(e)) return classKey(e)
    if (ts.isCallExpression(e) && calleeOf(e) === TAG_CALL) {
      if (!e.arguments[0]) return fail(e, 'GenericTag() needs a key')
      // Located at the use site: that is where the unreadable Tag leaves the graph.
      if (!checker.getTypeAtLocation(e.arguments[0]).isStringLiteral())
        return fail(expr, `Tag "${text(expr)}" has a non-literal key "${text(e.arguments[0])}"`)
      return literal(e.arguments[0], 'Tag key')
    }
    return fail(expr, `"${text(expr)}" does not resolve to a Tag declaration`)
  }

  const tagList = (e: ts.Expression | undefined): string[] => {
    const out: string[] = []
    listOf(e, (t) => out.push(tagKey(t)))
    return out
  }

  const providers = new Map<string, ProviderDecl>()
  const ids = new Map<ts.Node, number>()
  const nid = (n: ts.Node) => ids.get(n) ?? (ids.set(n, ids.size), ids.size - 1)
  /** One declaration per node and loop binding: a list evaluated once and reused keeps its entries' identity. */
  const cacheKey = (n: ts.Node) => {
    // Only bindings the declaration reads, and invocations of helpers that enclose it, distinguish it.
    const refs = new Set<ts.Declaration>()
    const scan = (x: ts.Node): void => {
      if (ts.isIdentifier(x)) {
        const sym = ts.isShorthandPropertyAssignment(x.parent)
          ? checker.getShorthandAssignmentValueSymbol(x.parent)
          : checker.getSymbolAtLocation(x)
        const d = sym?.valueDeclaration
        if (d && env.has(d)) refs.add(d)
      }
      ts.forEachChild(x, scan)
    }
    scan(n)
    const parts = [...refs].map((d) => `${nid(d)}=${nid(follow(env.get(d)!))}`)
    for (const [scope, inst] of scopes)
      if (scope !== n && scope.pos <= n.pos && n.end <= scope.end && scope.getSourceFile() === n.getSourceFile())
        parts.push(`${nid(scope)}:${inst}`)
    return [nid(n), ...parts.sort()].join(',')
  }
  const provider = (expr: ts.Expression, core: boolean): ProviderDecl => {
    const e = follow(expr)
    const key = cacheKey(e)
    const hit = providers.get(key)
    if (hit) return hit
    let p: ProviderDecl
    const id = ts.isCallExpression(e) ? calleeOf(e) : undefined
    const a = ts.isCallExpression(e) ? e.arguments : ts.factory.createNodeArray<ts.Expression>()
    const base = { opaque: false, loc: loc(e) }
    if (id === 'core/module#declareLayer') {
      // What it provides and requires comes from the wrapped Layer's type; only the lifetime is a literal option.
      if (!a[0]) return fail(e, 'declareLayer() needs a Layer')
      p = { ...layerLeaf(a[0]), loc: base.loc, lifetime: lifetimeOf(prop(objectOf(a[1]), 'lifetime')) }
    } else if (core && checker.getTypeAtLocation(expr).getSymbol()?.getName() === 'Layer') {
      p = { ...base, opaque: true, provides: [], requires: [], lifetime: undefined } // self-contained bare Layer
    } else {
      return fail(expr, `"${text(expr)}" is not a recognized declareLayer() declaration`)
    }
    providers.set(key, p)
    return p
  }

  const modules = new Map<string, ModuleDecl>()
  const moduleOf = (expr: ts.Expression): ModuleDecl => {
    const e = follow(expr)
    const key = cacheKey(e)
    const hit = modules.get(key)
    if (hit) return hit
    if (!ts.isCallExpression(e) || calleeOf(e) !== MODULE_CALL)
      return fail(expr, `"${text(expr)}" does not resolve to a module() declaration`)
    const cfg = objectOf(e.arguments[0])
    const nameExpr = prop(cfg, 'name')
    const m: ModuleDecl = {
      name: nameExpr ? literal(nameExpr, 'module name') : fail(e, 'module() needs a name'),
      entries: [],
      imports: [],
      exports: undefined,
      lifetime: undefined,
      loc: loc(e),
    }
    modules.set(key, m) // before imports: thunk cycles terminate
    // Each field reports independently, so one unreadable list does not hide the others.
    const field = (f: () => void) => {
      try {
        f()
      } catch (err) {
        report(err, m)
      }
    }
    field(() =>
      listOf(prop(cfg, 'entries'), (x) => {
        try {
          m.entries.push(provider(x, true))
        } catch (err) {
          if (err instanceof Unbound) throw err
          report(err, m)
        }
      }),
    )
    field(() => {
      let imp = prop(cfg, 'imports')
      const th = imp && unwrap(imp)
      if (th && (ts.isArrowFunction(th) || ts.isFunctionExpression(th))) {
        const ret = ts.isBlock(th.body) ? th.body.statements.find(ts.isReturnStatement)?.expression : th.body
        imp = ret ?? fail(th, 'imports thunk must return an array')
      }
      listOf(imp, (x) => {
        try {
          m.imports.push(moduleOf(x))
        } catch (err) {
          if (err instanceof Unbound) throw err
          report(err, m)
        }
      })
    })
    field(() => {
      const x = prop(cfg, 'exports')
      if (x) m.exports = tagList(x)
    })
    field(() => {
      m.lifetime = lifetimeOf(prop(cfg, 'lifetime'))
    })
    return m
  }

  // Emitted `.js` / `.d.ts` next to a `.ts` source shadows it: refuse rather than analyze stale output.
  const sources: ts.SourceFile[] = []
  for (const sf of program.getSourceFiles()) {
    if (/[\\/]node_modules[\\/]/.test(sf.fileName)) continue
    const stem = sf.fileName.replace(/(\.d)?\.(ts|tsx|js|jsx|mjs|cjs)$/, '')
    if (/\.(d\.ts|js|jsx)$/.test(sf.fileName) && ['.ts', '.tsx'].some((x) => fs.existsSync(stem + x))) {
      errors.push(
        analyzeError(
          'EmittedSibling',
          `${path.relative(root, sf.fileName)} is emitted output next to its .ts source; delete it`,
          { file: path.relative(root, sf.fileName), line: 1 },
        ),
      )
      continue
    }
    if (!sf.isDeclarationFile && program.getRootFileNames().includes(sf.fileName)) sources.push(sf)
  }

  const found: ModuleDecl[] = []
  const atomNodes: Atoms['nodes'][number][] = []
  const atomEdges: Edge[] = []
  const runtimes: ModuleDecl[] = []
  const extraRoots: ExtraRoot[] = []
  const entryFiles = entries && new Set(entries.map((f) => path.resolve(f)))
  const isRootFile = (sf: ts.SourceFile) =>
    entryFiles ? entryFiles.has(path.resolve(sf.fileName)) : !TEST_FILE.test(path.relative(root, sf.fileName))
  const plain = new Map<string, ProviderDecl>()
  /** Every `Context.GenericTag<S>('K')` declaration in the program, by its identifier type `S`. */
  let genericIndex: Map<ts.Type, string[]> | undefined
  const genericTags = (): Map<ts.Type, string[]> => {
    if (genericIndex) return genericIndex
    const idx = new Map<ts.Type, string[]>()
    const visit = (n: ts.Node): void => {
      if (
        ts.isCallExpression(n) &&
        calleeOf(n) === 'effect/Context#GenericTag' &&
        n.arguments[0] &&
        checker.getTypeAtLocation(n.arguments[0]).isStringLiteral()
      ) {
        const id = checker.getTypeArguments(checker.getTypeAtLocation(n) as ts.TypeReference)[0]
        if (id) idx.set(id, [...(idx.get(id) ?? []), literal(n.arguments[0], 'Tag key')])
      }
      ts.forEachChild(n, visit)
    }
    for (const sf of program.getSourceFiles())
      if (!sf.isDeclarationFile && !sf.fileName.includes('node_modules')) visit(sf)
    return (genericIndex = idx)
  }
  /** A plain Layer leaf, read from its type: ROut Tags are what it provides, RIn Tags what it requires. */
  const layerLeaf = (e: ts.Expression): ProviderDecl => {
    const key = cacheKey(e)
    const hit = plain.get(key)
    if (hit) return hit
    const t = checker.getTypeAtLocation(e)
    if (t.flags & ts.TypeFlags.Any)
      return fail(e, `Layer "${text(e)}" is typed any; what it provides cannot be named`, 'Computed')
    if (libId(t.getSymbol(), checker) !== 'effect/Layer#Layer') return fail(e, `"${text(e)}" is not a Layer`)
    const [rOut, , rIn] = checker.getTypeArguments(t as ts.TypeReference)
    const tags = (x: ts.Type | undefined) =>
      !x || x.flags & ts.TypeFlags.Never
        ? []
        : (x.isUnion() ? x.types : [x]).map((m) => {
            const d = m.getSymbol()?.valueDeclaration
            if (m.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))
              return fail(
                e,
                `Layer "${text(e)}" names "${checker.typeToString(m)}", which does not resolve to a Tag declaration`,
                'Computed',
              )
            if (isTagClass(d)) return classKey(d)
            // `Context.GenericTag<S>('K')` has S as its identifier type, so a Layer's ROut/RIn carry S itself.
            const generic = genericTags().get(m)
            if (generic?.length === 1) return generic[0]!
            return fail(
              e,
              generic
                ? `Layer "${text(e)}" names "${checker.typeToString(m)}", which ${generic.length} GenericTags share; use a Tag class to tell them apart`
                : `Layer "${text(e)}" names "${checker.typeToString(m)}", which does not resolve to a Tag declaration`,
              'Computed',
            )
          })
    const p: ProviderDecl = { provides: tags(rOut), requires: tags(rIn), lifetime: 'app', opaque: false, loc: loc(e) }
    plain.set(key, p)
    return p
  }
  /** Every leaf of a plain Layer: `mergeAll/merge/provide/provideMerge` (and `.pipe` of them) are walked, anything else is a leaf. */
  const plainLayer = (expr: ts.Expression, out: (p: ProviderDecl) => void): void => {
    if (checker.getTypeAtLocation(expr).flags & ts.TypeFlags.Any)
      return fail(expr, `Layer "${text(expr)}" is typed any; what it provides cannot be named`, 'Computed')
    const e = follow(expr)
    if (ts.isClassDeclaration(e)) return fail(expr, `"${text(expr)}" is a class, not a Layer`)
    const args = (c: ts.CallExpression) =>
      c.arguments.forEach((a) =>
        checker.isArrayLikeType(checker.getTypeAtLocation(a))
          ? listOf(a, (x) => plainLayer(x, out))
          : plainLayer(a, out),
      )
    if (ts.isCallExpression(e) && LAYER_COMBINATORS.has(calleeOf(e) ?? '')) return args(e)
    if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) && e.expression.name.text === 'pipe') {
      plainLayer(e.expression.expression, out)
      for (const step of e.arguments) {
        const s = unwrap(step)
        if (!ts.isCallExpression(s) || !LAYER_COMBINATORS.has(calleeOf(s) ?? ''))
          return fail(
            step,
            `Layer pipe step "${text(step)}" is not Layer.merge/provide/provideMerge; its graph cannot be read`,
            'Computed',
          )
        args(s)
      }
      return
    }
    out(layerLeaf(e))
  }
  /** A `configureRuntime({ provide, layer })` call as a root: a synthetic module importing its modules and holding its layers (a plain `layer`'s leaves included). */
  const runtimeOf = (n: ts.CallExpression) => {
    const l = loc(n)
    const m: ModuleDecl = {
      name: `${l.file}:${l.line}`,
      entries: [],
      imports: [],
      exports: undefined,
      lifetime: undefined,
      loc: l,
    }
    runtimes.push(m)
    try {
      const layer = prop(objectOf(n.arguments[0]), 'layer')
      if (layer) plainLayer(layer, (p) => m.entries.push(p))
    } catch (err) {
      report(err, m)
    }
    try {
      listOf(prop(objectOf(n.arguments[0]), 'provide'), (x) => {
        try {
          const f = follow(x)
          if (ts.isCallExpression(f) && calleeOf(f) === MODULE_CALL) m.imports.push(moduleOf(x))
          else m.entries.push(provider(x, false))
        } catch (err) {
          if (err instanceof Unbound) throw err
          report(err, m)
        }
      })
    } catch (err) {
      report(err, m)
    }
  }
  /** A `class X extends Context.Tag('X')<X, S>() {}` (or `Effect.Tag`) declaration. */
  const isTagClass = (d: ts.Declaration | undefined): d is ts.ClassDeclaration => {
    const ext =
      d && ts.isClassDeclaration(d)
        ? d.heritageClauses?.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword)?.types[0]?.expression
        : undefined
    return (
      !!ext &&
      ts.isCallExpression(ext) &&
      ts.isCallExpression(ext.expression) &&
      TAG_CLASS_CALLS.has(calleeOf(ext.expression) ?? '')
    )
  }

  /**
   * An `Atom.make` over an Effect / Stream (or a read function returning one) is a node; each Tag its `R` names is an
   * edge. Value and plain derived atoms read no services and are skipped. Named by its enclosing const.
   */
  const atomOf = (n: ts.CallExpression, arg: ts.Expression) => {
    const t = checker.getTypeAtLocation(arg)
    const sigs = t.getCallSignatures()
    const eff = sigs.length ? checker.getReturnTypeOfSignature(sigs[0]!) : t
    const kind = libId(eff.getSymbol(), checker)
    // A Tag is an Effect of its service: it requires itself.
    const cls = eff.getSymbol()?.valueDeclaration
    let requires: string[]
    if (isTagClass(cls)) requires = [classKey(cls)]
    else if (kind === 'effect/Context#Tag')
      requires = [tagOf(checker.getTypeArguments(eff as ts.TypeReference)[0]!, arg)]
    else if (kind === 'effect/Effect#Effect' || kind === 'effect/Stream#Stream') {
      const r = checker.getTypeArguments(eff as ts.TypeReference)[2]
      requires = !r || r.flags & ts.TypeFlags.Never ? [] : (r.isUnion() ? r.types : [r]).map((m) => tagOf(m, arg))
    } else return
    const v = ts.findAncestor(n, ts.isVariableDeclaration)
    const l = loc(n)
    const aid = `atom:${v && ts.isIdentifier(v.name) ? v.name.text : `${l.file}:${l.line}`}`
    atomNodes.push({ id: aid, ...l })
    for (const tag of requires) atomEdges.push({ from: aid, to: tag, tag })
  }
  /** The Tag key a requirement type names: a `Context.Tag` class, or the one `Context.GenericTag<S>` keyed by `S`. */
  const tagOf = (m: ts.Type, at: ts.Node): string => {
    if (!(m.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))) {
      const d = m.getSymbol()?.valueDeclaration
      if (isTagClass(d)) return classKey(d)
      const generic = genericTags().get(m)
      if (generic?.length === 1) return generic[0]!
    }
    return fail(
      at,
      `"${text(at)}" requires "${checker.typeToString(m)}", which does not resolve to exactly one Tag declaration`,
    )
  }
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n)) {
      const id = calleeOf(n)
      // A module() inside a function is evaluated where it is called (with its bindings), never bare.
      if (id === MODULE_CALL && !ts.findAncestor(n, ts.isFunctionLike)) {
        try {
          found.push(moduleOf(n))
        } catch (err) {
          report(err)
        }
      } else if (id && RUNTIME_CALLS.has(id) && isRootFile(n.getSourceFile())) {
        try {
          runtimeOf(n)
        } catch (err) {
          report(err)
        }
      } else if (id === ATOM_CALL && n.arguments[0]) {
        try {
          atomOf(n, n.arguments[0])
        } catch (err) {
          report(err)
        }
      } else if (id && RUNTIME_RUN_CALLS.has(id) && isRootFile(n.getSourceFile())) {
        try {
          extraRoots.push(
            ...runEffectRoots(n, {
              loc,
              text,
              unwrap,
              follow,
              fail,
              plainLayer,
              report,
              lenient,
              isUnreadable: (e) => e instanceof Unreadable || e instanceof Unbound,
            }),
          )
        } catch (err) {
          report(err)
        }
      }
    }
    ts.forEachChild(n, visit)
  }
  sources.forEach(visit)

  const imported = new Set(found.flatMap((m) => m.imports))
  const roots = [...new Set(found)].filter((m) => !imported.has(m))
  // A cycle through the top module leaves no unimported root: each unreached component still gets one.
  const reached = new Set(roots.flatMap((r) => [...resolve(r).visits.keys()]))
  for (const m of new Set(found))
    if (!reached.has(m)) {
      roots.push(m)
      resolve(m).visits.forEach((_, k) => reached.add(k))
    }
  const inModules = new Set([...owned.values()].flat())
  const extraction = errors.filter((e) => !inModules.has(e))
  for (const r of roots) errors.push(...validate(r))
  const runtimeReports: Report['runtimes'][number][] = runtimes.map((m) => ({
    ...m.loc,
    kind: 'app',
    graph: graphOf(m),
    errors: [...[...resolve(m).visits.keys()].flatMap((v) => owned.get(v) ?? []), ...validate(m)],
  }))
  // App roots first; each runEffect root after them, checked over the app graph.
  for (const { kind, module: m } of extraRoots) {
    const { graph, errors: rootErrors } = checkRoot(m, runtimes)
    errors.push(...rootErrors)
    runtimeReports.push({ ...m.loc, kind, graph, errors: [...(owned.get(m) ?? []), ...rootErrors] })
  }
  return {
    graphs: roots.map(graphOf),
    atoms: { nodes: atomNodes, edges: atomEdges },
    // One defect reached twice (a provided module is also a root) is one error.
    errors: [...new Map(errors.map((e) => [`${e.code}|${e.file}:${e.line}|${e.message}`, e])).values()],
    extraction,
    runtimes: runtimeReports,
  }
}

export type Seen = { p: ProviderDecl; module: ModuleDecl; depth: number; paths: string[][] }
export interface Resolved {
  readonly visits: ReadonlyMap<ModuleDecl, { paths: string[][]; depth: number }>
  readonly all: readonly Seen[]
  /** Every provider of each Tag. */
  readonly byTag: ReadonlyMap<string, readonly Seen[]>
  /** The winning provider per Tag (first at the best depth; ties are validation's AmbiguousProvider). */
  readonly won: ReadonlyMap<string, Seen>
}

/** Mirrors core `resolveEntries`: module walk, per-Tag shadowing by locality. */
export function resolve(rootModule: ModuleDecl): Resolved {
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
  const all = [...seen.values()]
  const byTag = new Map<string, Seen[]>()
  for (const s of all) for (const k of s.p.provides) byTag.set(k, [...(byTag.get(k) ?? []), s])
  const won = new Map<string, Seen>()
  for (const [tag, ss] of byTag) {
    const best = Math.min(...ss.map((s) => s.depth))
    won.set(
      tag,
      ss.find((s) => s.depth === best)!,
    )
  }
  return { visits, all, byTag, won }
}

export const isPrivate = (m: ModuleDecl, key: string) => m.exports !== undefined && !m.exports.includes(key)

/** Mirrors core `snapshot`: one node per provided Tag, `Tag@Module` ids for shadowed providers. */
export function graphOf(rootModule: ModuleDecl): Graph {
  const { visits, all, byTag, won } = resolve(rootModule)
  const shadowing: Shadowing[] = []
  const shadowedId = (tag: string, s: Seen) => `${tag}@${s.module.name}`
  for (const [tag, ss] of byTag) {
    const losers = ss.filter((s) => s !== won.get(tag))
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
      nodes.push({
        ...base,
        id: shadowed ? shadowedId(k, s) : k,
        name: k,
        provides: [k],
        private: isPrivate(s.module, k),
        shadowed,
      })
    }
    for (const from of mine) for (const tag of s.p.requires) edges.push({ from, to: tag, tag })
  }

  return {
    root: rootModule.name,
    nodes,
    edges,
    shadowing,
    modules: [...visits.keys()].map((m) => ({
      name: m.name,
      imports: m.imports.map((i) => i.name),
      exports: m.exports ? [...m.exports] : null,
      ...m.loc,
    })),
    private: nodes.filter((n) => n.private).map((n) => n.id),
  }
}
