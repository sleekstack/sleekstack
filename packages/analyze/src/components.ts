/**
 * packages/analyze/src/components.ts
 *
 * The `@sleekstack/ui` component pass: one tree per `mount` call (nodes `component`, `provide`, `catch`,
 * `unresolved`), then one walk carrying the provided Tags and caught error tags downward. A component's
 * `E` / `R` come from its `Effect<Node, E, R>` type; a `Provide` layer's outputs from its `Layer` type. Every
 * branch of a conditional, `&&` or `.map` counts as rendered. Anything that cannot be read is `Unresolved`.
 */

import * as path from 'node:path'
import ts from 'typescript'
import { bodyReturns, libId, programOf, TEST_FILE, unwrap, Unreadable } from './extract'
import type { AnalyzeError, ComponentReport, ComponentTree, Location, UiNode } from './model'

export function analyzeComponents(opts: { readonly project: string }): ComponentReport {
  const { root, program, checker } = programOf(opts.project)
  const loc = (n: ts.Node): Location => {
    const sf = n.getSourceFile()
    return { file: path.relative(root, sf.fileName), line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 }
  }
  const text = (n: ts.Node) => n.getText().replace(/\s+/g, ' ').slice(0, 80)
  const fail = (n: ts.Node, message: string): never => {
    throw new Unreadable(n, message, 'Unresolved')
  }
  const calleeOf = (c: ts.CallExpression) => libId(checker.getSymbolAtLocation(c.expression), checker)
  const declOf = (e: ts.Expression): ts.Declaration | undefined => {
    let sym = checker.getSymbolAtLocation(e)
    if (sym && sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym)
    return sym?.valueDeclaration ?? sym?.declarations?.[0]
  }
  const isAny = (t: ts.Type) => !!(t.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))
  const members = (t: ts.Type | undefined) => (!t || t.flags & ts.TypeFlags.Never ? [] : t.isUnion() ? t.types : [t])

  /** `[A, E, R]` members of an `Effect<A, E, R>` type (or a union of them, as a ternary returns), else undefined. */
  const effectArgs = (t: ts.Type): [ts.Type[], ts.Type[], ts.Type[]] | undefined => {
    const out: [ts.Type[], ts.Type[], ts.Type[]] = [[], [], []]
    for (const m of t.isUnion() ? t.types : [t]) {
      if (libId(m.getSymbol(), checker) !== 'effect/Effect#Effect') return undefined
      checker.getTypeArguments(m as ts.TypeReference).forEach((a, i) => out[i]?.push(...members(a)))
    }
    return out
  }
  const isNodeMember = (m: ts.Type) => libId(m.aliasSymbol, checker) === 'ui/node#Node' || /^ui\/node#(Text|Element|Fragment|Guest)Node$/.test(libId(m.getSymbol(), checker) ?? '')
  const isNode = (a: ts.Type[] | undefined) => !!a && a.length > 0 && a.every(isNodeMember)
  const isNodeEffect = (t: ts.Type) => isNode(effectArgs(t)?.[0])
  /** An Effect component value: an `Effect<Node>` or a function returning one. */
  const isEffectComponent = (t: ts.Type) => isNodeEffect(t) || t.getCallSignatures().some((s) => isNodeEffect(checker.getReturnTypeOfSignature(s)))

  const tagNames = (at: ts.Node, t: ts.Type | ts.Type[] | undefined, what: string) =>
    (Array.isArray(t) ? t : members(t)).map((m) => (isAny(m) ? fail(at, `"${text(at)}" ${what} "${checker.typeToString(m)}", which names no Tag`) : checker.typeToString(m)))
  const errorTags = (at: ts.Node, t: ts.Type[]) =>
    t.map((m) => {
      if (isAny(m)) return fail(at, `"${text(at)}" fails with "${checker.typeToString(m)}"; its errors cannot be named`)
      const tag = m.getProperty('_tag')
      const tt = tag && checker.getTypeOfSymbolAtLocation(tag, at)
      return tt?.isStringLiteral() ? tt.value : checker.typeToString(m) // untagged: no Catch can handle it
    })
  /** The Tags a Layer-typed expression provides (`ROut`) and requires (`RIn`). */
  const layerTags = (at: ts.Node, t: ts.Type) => {
    if (isAny(t) || libId(t.getSymbol(), checker) !== 'effect/Layer#Layer') return fail(at, `"${text(at)}" is not a readable Layer`)
    const [rOut, , rIn] = checker.getTypeArguments(t as ts.TypeReference)
    return { provides: tagNames(at, rOut, 'provides'), requires: tagNames(at, rIn, 'requires') }
  }

  /** What a callee names: a local function, or the call that produced it (`fromReact(X)`, `pick()`). */
  const calleeTarget = (expr: ts.Expression): ts.FunctionLikeDeclaration | ts.CallExpression => {
    const e = unwrap(expr)
    if ((ts.isArrowFunction(e) || ts.isFunctionExpression(e)) && e.body) return e
    if (ts.isCallExpression(e)) return e
    if (ts.isIdentifier(e) || ts.isPropertyAccessExpression(e)) {
      const d = declOf(e)
      if (d && ts.isFunctionDeclaration(d) && d.body) return d
      if (d && ts.isVariableDeclaration(d) && d.initializer && ts.getCombinedNodeFlags(d) & ts.NodeFlags.Const) return calleeTarget(d.initializer)
    }
    return fail(expr, `"${text(expr)}" is a dynamic component; its declaration cannot be read`)
  }

  const stack = new Set<ts.Node>()
  /** Every node an `Effect<Node>`-valued expression renders. */
  const build = (expr: ts.Expression): UiNode[] => {
    try {
      return read(expr)
    } catch (err) {
      if (!(err instanceof Unreadable)) throw err
      return [{ kind: 'unresolved', message: err.message, ...loc(err.node) }]
    }
  }
  const read = (expr: ts.Expression): UiNode[] => {
    const e = unwrap(expr)
    if (ts.isConditionalExpression(e)) return [...build(e.whenTrue), ...build(e.whenFalse)]
    if (ts.isBinaryExpression(e) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(e.operatorToken.kind))
      return [...(e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ? [] : build(e.left)), ...build(e.right)]
    if (ts.isArrayLiteralExpression(e)) return e.elements.flatMap((x) => build(ts.isSpreadElement(x) ? x.expression : x))
    const t = checker.getTypeAtLocation(e)
    if (isAny(t)) return fail(e, `"${text(e)}" is typed ${checker.typeToString(t)}; what it renders cannot be read`)
    if (ts.isIdentifier(e) || ts.isPropertyAccessExpression(e)) {
      const d = declOf(e)
      if (d && ts.isVariableDeclaration(d) && d.initializer && ts.getCombinedNodeFlags(d) & ts.NodeFlags.Const) return build(d.initializer)
      return fail(e, `"${text(e)}" has no readable const declaration`)
    }
    if (!ts.isCallExpression(e)) return fail(e, `"${text(e)}" is not a readable component expression`)
    const id = calleeOf(e)
    const [a0, a1, a2] = e.arguments
    if (id === 'ui/component#Provide' && a0 && a1) {
      const { provides, requires } = layerTags(a0, checker.getTypeAtLocation(a0))
      return [{ kind: 'provide', provides, requires, children: build(a1), ...loc(e) }]
    }
    if (id === 'ui/component#Catch' && a0 && a2) {
      const tt = checker.getTypeAtLocation(a0)
      if (!tt.isStringLiteral()) return fail(a0, `Catch tag "${text(a0)}" is not a string literal`)
      return [{ kind: 'catch', tag: tt.value, children: build(a2), ...loc(e) }]
    }
    if (id === 'effect/Effect#gen') {
      const body = e.arguments.map(unwrap).find((x): x is ts.FunctionExpression => ts.isFunctionExpression(x) && !!x.asteriskToken)
      return body ? yields(body) : fail(e, `Effect.gen "${text(e)}" has no readable function* body`)
    }
    if (id === 'effect/Effect#all') return e.arguments.flatMap(list)
    if (id?.startsWith('effect/')) {
      // A leaf like Effect.succeed(node); an Effect-producing callback hides what it renders.
      const ts_ = e.arguments.map((x) => checker.getTypeAtLocation(x))
      if (ts_.some((x) => !effectArgs(x) && x.getCallSignatures().some((s) => effectArgs(checker.getReturnTypeOfSignature(s))))) return fail(e, `"${text(e)}" renders through a callback; its tree cannot be read`)
      return e.arguments.filter((x, i) => isNodeEffect(ts_[i]!)).flatMap(build)
    }
    if (id) return fail(e, `"${text(e)}" is not a component`)
    const target = calleeTarget(e.expression)
    if (ts.isCallExpression(target)) {
      if (calleeOf(target) === 'ui/component#fromReact' && target.arguments[0]) return [guest(e, target.arguments[0])]
      return fail(e.expression, `"${text(e.expression)}" is a dynamic component; its declaration cannot be read`)
    }
    const args = effectArgs(t)
    if (!args || !isNode(args[0])) return fail(e, `"${text(e)}" does not return Effect<Node, E, R>`)
    // Unreadable E / R members fail closed at the call, without hiding what its body renders.
    const own: UiNode[] = [...args[1], ...args[2]].some(isAny) ? [{ kind: 'unresolved', message: `"${text(e)}" has E / R typed any or unknown; its errors and requirements cannot be named`, ...loc(e) }] : []
    const node: UiNode = { kind: 'component', name: text(e.expression), guest: false, requires: tagNames(e, args[2].filter((m) => !isAny(m)), 'requires'), errors: errorTags(e, args[1].filter((m) => !isAny(m))), children: [], ...loc(e) }
    if (stack.has(target)) return [node, ...own]
    stack.add(target)
    try {
      return [{ ...node, children: bodyReturns(target).flatMap(build) }, ...own]
    } finally {
      stack.delete(target)
    }
  }
  /** Members of a rendered list: array literals through const bindings, and `.map` callbacks' returns. */
  const list = (expr: ts.Expression): UiNode[] => {
    const e = unwrap(expr)
    if (ts.isArrayLiteralExpression(e)) return read(e)
    if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) && ['map', 'flatMap'].includes(e.expression.name.text) && !calleeOf(e)) {
      const cb = e.arguments[0] && calleeTarget(e.arguments[0])
      if (cb && !ts.isCallExpression(cb)) return bodyReturns(cb).flatMap(e.expression.name.text === 'map' ? build : list)
    }
    if (ts.isIdentifier(e)) {
      const d = declOf(e)
      if (d && ts.isVariableDeclaration(d) && d.initializer && ts.getCombinedNodeFlags(d) & ts.NodeFlags.Const) return list(d.initializer)
    }
    if (isNodeEffect(checker.getTypeAtLocation(e))) return build(e)
    return fail(e, `"${text(e)}" is a widened list; its members cannot be read`)
  }
  /** Every rendering `yield*` in a generator body (nested functions excluded). */
  const yields = (fn: ts.FunctionLikeDeclaration): UiNode[] => {
    const out: UiNode[] = []
    const walk = (n: ts.Node): void => {
      if (ts.isFunctionLike(n)) return
      if (ts.isYieldExpression(n) && n.asteriskToken && n.expression) {
        const t = checker.getTypeAtLocation(n.expression)
        if (isAny(t)) out.push({ kind: 'unresolved', message: `yield* "${text(n.expression)}" is typed ${checker.typeToString(t)}`, ...loc(n.expression) })
        else if (isNodeEffect(t)) out.push(...build(n.expression))
      }
      ts.forEachChild(n, walk)
    }
    if (fn.body) ts.forEachChild(fn.body, walk)
    return out
  }
  /** A `fromReact` guest: Effect components in its props or in its React body are its (illegal) children. */
  const guest = (call: ts.CallExpression, cmp: ts.Expression): UiNode => {
    const inside: UiNode[] = []
    const found = (n: ts.Node) => inside.push({ kind: 'component', name: text(n), guest: false, requires: [], errors: [], children: [], ...loc(n) })
    const props = call.arguments[0] && unwrap(call.arguments[0])
    if (props && ts.isObjectLiteralExpression(props)) {
      for (const p of props.properties) if (isEffectComponent(checker.getTypeAtLocation(ts.isPropertyAssignment(p) ? p.initializer : p))) found(p)
    } else if (props && checker.getPropertiesOfType(checker.getTypeAtLocation(props)).some((s) => isEffectComponent(checker.getTypeOfSymbolAtLocation(s, props)))) found(props)
    let body: ts.Node | undefined
    try {
      const target = calleeTarget(cmp)
      body = ts.isCallExpression(target) ? undefined : target
    } catch {
      body = undefined // a class or imported React component: its body is React's, read only when local
    }
    const scan = (n: ts.Node): void => {
      const tagName = ts.isJsxElement(n) ? n.openingElement.tagName : ts.isJsxSelfClosingElement(n) ? n.tagName : undefined
      if (tagName && isEffectComponent(checker.getTypeAtLocation(tagName))) found(n)
      else if (ts.isCallExpression(n) && isNodeEffect(checker.getTypeAtLocation(n))) found(n)
      ts.forEachChild(n, scan)
    }
    if (body) ts.forEachChild(body, scan)
    return { kind: 'component', name: text(call.expression), guest: true, requires: [], errors: [], children: inside, ...loc(call) }
  }

  const trees: ComponentTree[] = []
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && calleeOf(n) === 'ui/dom#mount' && n.arguments[0]) {
      let provides: readonly string[] = []
      let root: UiNode
      try {
        const opts = n.arguments[1] ?? fail(n, 'mount() needs { layer }')
        const sym = checker.getTypeAtLocation(opts).getProperty('layer') ?? fail(opts, 'mount() options have no layer')
        const layer = checker.getTypeOfSymbolAtLocation(sym, opts)
        provides = layerTags(opts, layer).provides
        const nodes = build(n.arguments[0])
        root = nodes.length === 1 ? nodes[0]! : { kind: 'component', name: text(n.arguments[0]), guest: false, requires: [], errors: [], children: nodes, ...loc(n.arguments[0]) }
      } catch (err) {
        if (!(err instanceof Unreadable)) throw err
        root = { kind: 'unresolved', message: err.message, ...loc(err.node) }
      }
      trees.push({ provides, root, ...loc(n) })
    }
    ts.forEachChild(n, visit)
  }
  for (const sf of program.getSourceFiles()) {
    if (!sf.isDeclarationFile && program.getRootFileNames().includes(sf.fileName) && !TEST_FILE.test(path.relative(root, sf.fileName))) visit(sf)
  }

  const errors: AnalyzeError[] = []
  for (const t of trees) check(t.root, new Set(t.provides), new Set(), errors)
  return { trees, errors: [...new Map(errors.map((e) => [`${e.code}|${e.file}:${e.line}|${e.message}`, e])).values()] }
}

/**
 * Reports each missing Tag / uncaught error at the deepest node carrying it (a parent's type repeats its
 * children's). Returns the Tags and error tags already reported below.
 */
function check(n: UiNode, provided: ReadonlySet<string>, caught: ReadonlySet<string>, out: AnalyzeError[]): Set<string> {
  const at = { file: n.file, line: n.line }
  if (n.kind === 'unresolved') return (out.push({ code: 'Unresolved', message: n.message, ...at }), new Set())
  if (n.kind === 'component' && n.guest) {
    for (const c of n.children) out.push({ code: 'EffectInsideReact', message: `Effect component "${c.kind === 'component' ? c.name : ''}" is rendered under the React guest "${n.name}"`, file: c.file, line: c.line })
    return new Set()
  }
  const inner = n.kind === 'provide' ? new Set([...provided, ...n.provides]) : provided
  const innerCaught = n.kind === 'catch' ? new Set([...caught, n.tag]) : caught
  const below = new Set<string>()
  for (const c of n.children) for (const k of check(c, inner, innerCaught, out)) below.add(k)
  const requires = n.kind === 'catch' ? [] : n.requires
  const who = n.kind === 'component' ? `Component "${n.name}"` : 'Provide layer'
  for (const r of requires) {
    if (provided.has(r) || below.has(`R:${r}`)) continue
    below.add(`R:${r}`)
    out.push({ code: 'MissingDependency', message: `${who} requires "${r}", but no enclosing Provide or mount layer provides it`, ...at })
  }
  for (const e of n.kind === 'component' ? n.errors : []) {
    if (caught.has(e) || below.has(`E:${e}`)) continue
    below.add(`E:${e}`)
    out.push({ code: 'UnhandledError', message: `${who} can fail with "${e}", but no enclosing Catch handles it`, ...at })
  }
  return below
}
