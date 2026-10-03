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
import { analyzeError } from './errorCodes'
import type { AnalyzeError, ComponentReport, ComponentTree, Location, UiNode } from './model'

/** `@sleekstack/ui`'s `Store`, provided by every `mount` (ui/dom.ts) whatever its layer. */
const UI_STORE = 'Store'

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
  const isNodeMember = (m: ts.Type) => libId(m.aliasSymbol, checker) === 'ui/node#Node' || /^ui\/node#(Text|Element|Fragment|Guest|Reactive)Node$/.test(libId(m.getSymbol(), checker) ?? '')
  /** A `Node`, or an array / tuple of them (what `Effect.all` over rendered components succeeds with). */
  const isRendered = (m: ts.Type) => isNodeMember(m) || ((checker.isArrayType(m) || checker.isTupleType(m)) && checker.getTypeArguments(m as ts.TypeReference).every(isNodeMember))
  const isNode = (a: ts.Type[] | undefined) => !!a && a.length > 0 && a.every(isRendered)
  const isNodeEffect = (t: ts.Type) => isNode(effectArgs(t)?.[0])
  /** An Effect component value: an `Effect<Node>` or a function returning one. */
  const isEffectComponent = (t: ts.Type) => isNodeEffect(t) || t.getCallSignatures().some((s) => isNodeEffect(checker.getReturnTypeOfSignature(s)))

  /** A Tag's name; any Tag printed `Store` other than `@sleekstack/ui`'s (which every `mount` provides) is printed with its file so it cannot pass as it. */
  const tagName = (m: ts.Type) => {
    const name = checker.typeToString(m)
    const sym = m.getSymbol()
    return name === UI_STORE && libId(sym, checker) !== 'ui/reactive#Store' ? `${sym?.declarations?.[0] ? loc(sym.declarations[0]).file : '?'}#${name}` : name
  }
  const tagNames = (at: ts.Node, t: ts.Type | ts.Type[] | undefined, what: string) =>
    (Array.isArray(t) ? t : members(t)).map((m) => (isAny(m) ? fail(at, `"${text(at)}" ${what} "${checker.typeToString(m)}", which names no Tag`) : tagName(m)))
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
    if (ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e)) return jsx(e)
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
      if (calleeOf(target) === 'ui/component#fromReact' && target.arguments[0]) {
        const props = e.arguments[0] && unwrap(e.arguments[0])
        const given = props && ts.isObjectLiteralExpression(props) ? props.properties.map((p) => [p, propType(p)] as const) : props ? [[props, checker.getTypeAtLocation(props)] as const] : []
        return [guest(e, text(e.expression), target.arguments[0], given)]
      }
      return fail(e.expression, `"${text(e.expression)}" is a dynamic component; its declaration cannot be read`)
    }
    if (stack.has(target)) return component(e, text(e.expression), () => [])
    stack.add(target)
    try {
      return component(e, text(e.expression), () => bodyReturns(target).flatMap(build))
    } finally {
      stack.delete(target)
    }
  }
  /** An attribute's value expression (`a="x"` or `a={x}`). */
  const attrOf = (open: ts.JsxOpeningLikeElement, name: string): ts.Expression | undefined => {
    const a = open.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === name)
    return a?.initializer && (ts.isJsxExpression(a.initializer) ? a.initializer.expression : a.initializer)
  }
  /** What a `{expr}` between JSX tags renders: Effect components through branches and `.map`; plain values render nothing to analyze. */
  const embedded = (x: ts.Expression): UiNode[] => {
    const e = unwrap(x)
    if (ts.isConditionalExpression(e)) return [...embedded(e.whenTrue), ...embedded(e.whenFalse)]
    if (ts.isBinaryExpression(e) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(e.operatorToken.kind))
      return [...(e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ? [] : embedded(e.left)), ...embedded(e.right)]
    if (ts.isArrayLiteralExpression(e)) return e.elements.flatMap((m) => embedded(ts.isSpreadElement(m) ? m.expression : m))
    const t = checker.getTypeAtLocation(e)
    if (isNodeEffect(t)) return build(e)
    const item = checker.isArrayType(t) ? checker.getTypeArguments(t as ts.TypeReference)[0] : undefined
    return item && isNodeEffect(item) ? list(e) : []
  }
  /** A JSX element or fragment: host elements are transparent, `Provider` / `Boundary` become `provide` / `catch`, anything else a component. */
  const jsx = (e: ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment): UiNode[] => {
    const open = ts.isJsxElement(e) ? e.openingElement : ts.isJsxSelfClosingElement(e) ? e : undefined
    const kids = (ts.isJsxSelfClosingElement(e) ? [] : e.children).flatMap((c) => (ts.isJsxText(c) ? [] : ts.isJsxExpression(c) ? (c.expression ? embedded(c.expression) : []) : build(c)))
    if (!open) return kids
    const tag = open.tagName
    if (ts.isIdentifier(tag) && /^[a-z]/.test(tag.text)) return kids
    const id = libId(checker.getSymbolAtLocation(tag), checker)
    if (id === 'ui/jsx-runtime#Fragment') return kids
    if (id === 'ui/jsx-runtime#Provider') {
      const layer = attrOf(open, 'layer') ?? fail(e, '<Provider> needs a layer')
      const { provides, requires } = layerTags(layer, checker.getTypeAtLocation(layer))
      return [{ kind: 'provide', provides, requires, children: kids, ...loc(e) }]
    }
    if (id === 'ui/jsx-runtime#Boundary') {
      const t = attrOf(open, 'tag') ?? fail(e, '<Boundary> needs a tag')
      const tt = ts.isStringLiteralLike(unwrap(t)) ? { value: (unwrap(t) as ts.StringLiteralLike).text } : checker.getTypeAtLocation(t)
      if (!('value' in tt)) return fail(t, `Boundary tag "${text(t)}" is not a string literal`)
      const fb = attrOf(open, 'fallback')
      const target = fb && calleeTarget(fb)
      // The fallback renders outside the boundary: its components are siblings, not caught children.
      return [{ kind: 'catch', tag: tt.value, children: kids, ...loc(e) }, ...(target && !ts.isCallExpression(target) ? bodyReturns(target).flatMap(build) : [])]
    }
    if (ts.isJsxNamespacedName(tag)) return fail(tag, `"${text(tag)}" is not a component`)
    const target = calleeTarget(tag)
    const sig = checker.getTypeAtLocation(tag).getCallSignatures()[0]
    if (!sig) return fail(tag, `"${text(tag)}" is not a component`)
    const type = checker.getReturnTypeOfSignature(sig)
    if (ts.isCallExpression(target)) {
      if (calleeOf(target) !== 'ui/component#fromReact' || !target.arguments[0]) return fail(tag, `"${text(tag)}" is a dynamic component; its declaration cannot be read`)
      const given = open.attributes.properties.flatMap((p) => {
        const v = ts.isJsxSpreadAttribute(p) ? p.expression : p.initializer && (ts.isJsxExpression(p.initializer) ? p.initializer.expression : p.initializer)
        return v ? [[p, checker.getTypeAtLocation(v)] as const] : []
      })
      return [guest(e, text(tag), target.arguments[0], given)]
    }
    if (stack.has(target)) return component(e, text(tag), () => kids, type)
    stack.add(target)
    try {
      return component(e, text(tag), () => [...bodyReturns(target).flatMap(build), ...kids], type)
    } finally {
      stack.delete(target)
    }
  }
  const propType = (p: ts.ObjectLiteralElementLike) => checker.getTypeAtLocation(ts.isPropertyAssignment(p) ? p.initializer : ts.isSpreadAssignment(p) ? p.expression : p)
  /** A component node carrying `e`'s `E` / `R`; unreadable members fail closed at `e` without hiding its children. */
  const component = (e: ts.Expression, name: string, children: () => UiNode[], type = checker.getTypeAtLocation(e)): UiNode[] => {
    const args = effectArgs(type)
    if (!args || !isNode(args[0])) return fail(e, `"${text(e)}" does not return Effect<Node, E, R>`)
    const own: UiNode[] = [...args[1], ...args[2]].some(isAny) ? [{ kind: 'unresolved', message: `"${text(e)}" has E / R typed any or unknown; its errors and requirements cannot be named`, ...loc(e) }] : []
    return [{ kind: 'component', name, guest: false, requires: tagNames(e, args[2].filter((m) => !isAny(m)), 'requires'), errors: errorTags(e, args[1].filter((m) => !isAny(m))), children: children(), ...loc(e) }, ...own]
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
  const guest = (at: ts.Node, name: string, cmp: ts.Expression, given: ReadonlyArray<readonly [ts.Node, ts.Type]>): UiNode => {
    const inside: UiNode[] = []
    const found = (n: ts.Node) => inside.push({ kind: 'component', name: text(n), guest: false, requires: [], errors: [], children: [], ...loc(n) })
    /** Whether a prop value's type holds an Effect component anywhere: nested objects, arrays and tuples included. */
    const carries = (t: ts.Type, at: ts.Node, seen = new Set<ts.Type>()): boolean => {
      if (isAny(t)) return fail(at, `Guest prop "${text(at)}" is typed ${checker.typeToString(t)}; whether it carries an Effect component cannot be read`)
      if (seen.has(t)) return false
      seen.add(t)
      if (isEffectComponent(t)) return true
      if (t.isUnion() || t.isIntersection()) return t.types.some((m) => carries(m, at, seen))
      if (checker.isArrayType(t) || checker.isTupleType(t)) return checker.getTypeArguments(t as ts.TypeReference).some((m) => carries(m, at, seen))
      if (!(t.flags & ts.TypeFlags.Object) || t.getCallSignatures().length) return false
      return checker.getPropertiesOfType(t).some((p) => carries(checker.getTypeOfSymbolAtLocation(p, at), at, seen))
    }
    const inspect = (n: ts.Node, t: ts.Type) => {
      try {
        if (carries(t, n)) found(n)
      } catch (err) {
        if (!(err instanceof Unreadable)) throw err
        inside.push({ kind: 'unresolved', message: err.message, ...loc(err.node) })
      }
    }
    for (const [n, t] of given) inspect(n, t)
    // The React body is scanned when local; a component declared in a library (.d.ts / node_modules) cannot hold app code.
    let body: ts.Node | undefined
    const d = declOf(unwrap(cmp))
    const external = !!d && (d.getSourceFile().isDeclarationFile || /[\\/]node_modules[\\/]/.test(d.getSourceFile().fileName))
    if (d && ts.isClassDeclaration(d) && !external) body = d
    else if (!external) {
      try {
        const target = calleeTarget(cmp)
        if (ts.isCallExpression(target)) fail(cmp, `React component "${text(cmp)}" is computed; its body cannot be read`)
        body = target
      } catch (err) {
        if (!(err instanceof Unreadable)) throw err
        inside.push({ kind: 'unresolved', message: err.message, ...loc(err.node) })
      }
    }
    const scan = (n: ts.Node): void => {
      const tagName = ts.isJsxElement(n) ? n.openingElement.tagName : ts.isJsxSelfClosingElement(n) ? n.tagName : undefined
      if (tagName && isEffectComponent(checker.getTypeAtLocation(tagName))) found(n)
      else if (ts.isCallExpression(n) && isNodeEffect(checker.getTypeAtLocation(n))) found(n)
      ts.forEachChild(n, scan)
    }
    if (body) ts.forEachChild(body, scan)
    else if (!external && !inside.some((n) => n.kind === 'unresolved')) inside.push({ kind: 'unresolved', message: `React component "${text(cmp)}" has no readable declaration`, ...loc(cmp) })
    return { kind: 'component', name, guest: true, requires: [], errors: [], children: inside, ...loc(at) }
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
        // The root carries the app's own E / R: what no node below accounts for is reported here.
        const app = n.arguments[0]
        const nodes = component(app, text(app), () => build(app))
        root = nodes.length === 1 ? nodes[0]! : { kind: 'component', name: text(app), guest: false, requires: [], errors: [], children: nodes, ...loc(app) }
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
  for (const t of trees) check(t.root, new Set([...t.provides, UI_STORE]), new Set(), errors)
  return { trees, errors: [...new Map(errors.map((e) => [`${e.code}|${e.file}:${e.line}|${e.message}`, e])).values()] }
}

/**
 * Reports each missing Tag / uncaught error at the deepest node carrying it (a parent's type repeats its
 * children's). Returns the Tags and error tags already reported below.
 */
function check(n: UiNode, provided: ReadonlySet<string>, caught: ReadonlySet<string>, out: AnalyzeError[]): Set<string> {
  const at = { file: n.file, line: n.line }
  if (n.kind === 'unresolved') return (out.push(analyzeError('Unresolved', n.message, at)), new Set())
  if (n.kind === 'component' && n.guest) {
    for (const c of n.children) {
      if (c.kind === 'unresolved') check(c, provided, caught, out)
      else out.push(analyzeError('EffectInsideReact', `Effect component "${c.kind === 'component' ? c.name : ''}" is rendered under the React guest "${n.name}"`, { file: c.file, line: c.line }))
    }
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
    out.push(analyzeError('MissingDependency', `${who} requires "${r}", but no enclosing Provide or mount layer provides it`, at))
  }
  for (const e of n.kind === 'component' ? n.errors : []) {
    if (caught.has(e) || below.has(`E:${e}`)) continue
    below.add(`E:${e}`)
    out.push(analyzeError('UnhandledError', `${who} can fail with "${e}", but no enclosing Catch handles it`, at))
  }
  return below
}
