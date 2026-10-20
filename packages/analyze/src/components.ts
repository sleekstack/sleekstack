/**
 * packages/analyze/src/components.ts
 *
 * The `@sleekstack/ui` component pass: one tree per `mount`, `resume`, `startRouter` or `handle` call (nodes `component`, `provide`, `catch`,
 * `unresolved`), then one walk carrying the provided Tags and caught error tags downward. A component's
 * `E` / `R` come from its `Effect<Node, E, R>` type; a `Provide` layer's outputs from its `Layer` type. Every
 * branch of a conditional, `&&` or `.map` counts as rendered. Anything that cannot be read is `Unresolved`.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import ts from 'typescript'
import { bodyReturns, libId, programOf, TEST_FILE, unwrap, Unreadable } from './extract'
import { analyzeError } from './errorCodes'
import type { AnalyzeError, ComponentReport, ComponentTree, Location, UiNode } from './model'

/** `@sleekstack/ui`'s `Store`, provided by every `mount` (ui/dom.ts) whatever its layer. */
const UI_STORE = 'Store'
/** Analyzer code for a handler the resume pass cannot prove resumable (fn-18). */
export const NON_RESUMABLE_HANDLER = 'NonResumableHandler' as const
/**
 * Tags a framework provides implicitly, by printed name and declaration: `Store` (every `mount`), and what the router
 * provides around pages (its `RouterProvided`). A same-named Tag declared elsewhere is printed with its file.
 */
const FRAMEWORK_TAGS: Record<string, string> = {
  [UI_STORE]: 'ui/reactive#Store',
  Transfer: 'ui/transfer#Transfer',
  Loaders: 'router/loader#Loaders',
  Route: 'router/index#Route',
}
/** The router's control flow, printed with this prefix so an app error with the same `_tag` cannot pass as it. */
const ROUTER_ERROR = '@sleekstack/router#'
const ROUTER_CONTROL: Record<string, string> = {
  Redirect: 'router/resolve#Redirect',
  NotFound: 'router/resolve#NotFound',
}
/** `@sleekstack/ui-vite`'s file-route module, typed by the `routes.gen.d.ts` it writes in `routesDir` (ADR 0045). */
const ROUTES_MODULE = 'virtual:sleekstack/routes'
const ROUTE_FILE = /\.[jt]sx?$/

export function analyzeComponents(opts: { readonly project: string }): ComponentReport {
  const { root, program, checker } = programOf(opts.project)
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
  const text = (n: ts.Node) => n.getText().replace(/\s+/g, ' ').slice(0, 80)
  const fail = (n: ts.Node, message: string): never => {
    throw new Unreadable(n, message, 'Unresolved')
  }
  const calleeOf = (c: ts.CallExpression) => libId(checker.getSymbolAtLocation(c.expression), checker)
  /** `model/<file>#<name>` for a callee declared in `@sleekstack/model` (its slot hooks live outside `ui`), else undefined. */
  const modelCalleeOf = (c: ts.CallExpression) => {
    let sym = checker.getSymbolAtLocation(c.expression)
    if (sym && sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym)
    const file = sym?.declarations?.[0]?.getSourceFile().fileName.replace(/\\/g, '/')
    const m = file && /\/(?:packages|@sleekstack)\/model\/(?:src|dist)\/(.+?)(?:\.d)?\.tsx?$/.exec(file)
    return m ? `model/${m[1]}#${sym!.name}` : undefined
  }
  const aliased = (sym: ts.Symbol | undefined): ts.Declaration | undefined => {
    if (sym && sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym)
    return sym?.valueDeclaration ?? sym?.declarations?.[0]
  }
  const declOf = (e: ts.Expression) => aliased(checker.getSymbolAtLocation(e))
  /** Declared in a `.d.ts` or under `node_modules`: library code, which holds no app components. */
  const external = (d: ts.Declaration | undefined) =>
    !!d && (d.getSourceFile().isDeclarationFile || /[\\/]node_modules[\\/]/.test(d.getSourceFile().fileName))
  const isAny = (t: ts.Type) => !!(t.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))
  const members = (t: ts.Type | undefined) => (!t || t.flags & ts.TypeFlags.Never ? [] : t.isUnion() ? t.types : [t])

  /**
   * `[A, E, R]` members of an `Effect<A, E, R>` type (or a union of them, as a ternary returns), else undefined. A generator
   * component's type reads the same way: its yielded `YieldWrap<Effect<_, E, R>>`s add to `E` / `R`, and what it returns
   * (an `Effect<A, E, R>`, or a plain `A`) gives `A`.
   */
  const effectArgs = (t: ts.Type): [ts.Type[], ts.Type[], ts.Type[]] | undefined => {
    const out: [ts.Type[], ts.Type[], ts.Type[]] = [[], [], []]
    for (const m of t.isUnion() ? t.types : [t]) {
      if (m.getSymbol()?.getName() === 'Generator') {
        const [y, r] = checker.getTypeArguments(m as ts.TypeReference)
        for (const w of members(y)) {
          const inner =
            w.getSymbol()?.getName() === 'YieldWrap' ? checker.getTypeArguments(w as ts.TypeReference)[0] : undefined
          const a = inner && (effectArgsOf(inner) ?? varianceArgs(inner))
          if (!a) return undefined
          out[1].push(...a[1])
          out[2].push(...a[2])
        }
        for (const x of members(r)) {
          const a = effectArgsOf(x)
          if (a) a.forEach((l, i) => out[i]!.push(...l))
          else out[0].push(x)
        }
        continue
      }
      const a = effectArgsOf(m)
      if (!a) return undefined
      a.forEach((l, i) => out[i]!.push(...l))
    }
    return out
  }
  /** `[A, E, R]` of anything Effect-shaped that is not an `Effect` itself (a Tag, an Option, ...), from its variance struct. */
  const varianceArgs = (m: ts.Type): [ts.Type[], ts.Type[], ts.Type[]] | undefined => {
    const v = m.getProperties().find((p) => p.getName().startsWith('__@EffectTypeId'))
    const struct = v && checker.getTypeOfSymbol(v)
    if (!struct) return undefined
    const arg = (name: string) => {
      const p = struct.getProperty(name)
      const sig = p && checker.getTypeOfSymbol(p).getCallSignatures()[0]
      return sig ? members(checker.getReturnTypeOfSignature(sig)) : undefined
    }
    const [a, e, r] = [arg('_A'), arg('_E'), arg('_R')]
    return a && e && r ? [a, e, r] : undefined
  }
  const effectArgsOf = (m: ts.Type): [ts.Type[], ts.Type[], ts.Type[]] | undefined => {
    if (libId(m.getSymbol(), checker) !== 'effect/Effect#Effect') return undefined
    const out: [ts.Type[], ts.Type[], ts.Type[]] = [[], [], []]
    checker.getTypeArguments(m as ts.TypeReference).forEach((a, i) => out[i]?.push(...members(a)))
    return out
  }
  const isNodeMember = (m: ts.Type) =>
    libId(m.aliasSymbol, checker) === 'ui/node#Node' ||
    /^ui\/node#(Text|Element|Fragment|Guest|Reactive|Bind|Portal)Node$/.test(libId(m.getSymbol(), checker) ?? '')
  /** A `Node`, or an array / tuple of them (what `Effect.all` over rendered components succeeds with). */
  const isRendered = (m: ts.Type) =>
    isNodeMember(m) ||
    ((checker.isArrayType(m) || checker.isTupleType(m)) &&
      checker.getTypeArguments(m as ts.TypeReference).every(isNodeMember))
  const isNode = (a: ts.Type[] | undefined) => !!a && a.length > 0 && a.every(isRendered)
  const isNodeEffect = (t: ts.Type) => isNode(effectArgs(t)?.[0])
  /** An Effect component value: an `Effect<Node>` or a function returning one. */
  const isEffectComponent = (t: ts.Type) =>
    isNodeEffect(t) || t.getCallSignatures().some((s) => isNodeEffect(checker.getReturnTypeOfSignature(s)))

  /** A Tag's name; a Tag printed like a framework Tag (`FRAMEWORK_TAGS`) but declared elsewhere is printed with its file so it cannot pass as it. */
  const tagName = (m: ts.Type) => {
    const name = checker.typeToString(m)
    const sym = m.getSymbol()
    return Object.hasOwn(FRAMEWORK_TAGS, name) && libId(sym, checker) !== FRAMEWORK_TAGS[name]
      ? `${sym?.declarations?.[0] ? loc(sym.declarations[0]).file : '?'}#${name}`
      : name
  }
  const tagNames = (at: ts.Node, t: ts.Type | ts.Type[] | undefined, what: string) =>
    (Array.isArray(t) ? t : members(t)).map((m) =>
      isAny(m) ? fail(at, `"${text(at)}" ${what} "${checker.typeToString(m)}", which names no Tag`) : tagName(m),
    )
  const errorTags = (at: ts.Node, t: ts.Type[]) =>
    t.map((m) => {
      if (isAny(m)) return fail(at, `"${text(at)}" fails with "${checker.typeToString(m)}"; its errors cannot be named`)
      const tag = m.getProperty('_tag')
      const tt = tag && checker.getTypeOfSymbolAtLocation(tag, at)
      if (!tt?.isStringLiteral()) return checker.typeToString(m) // untagged: no Catch can handle it
      const own = Object.hasOwn(ROUTER_CONTROL, tt.value) && ROUTER_CONTROL[tt.value] === libId(m.getSymbol(), checker)
      return own ? ROUTER_ERROR + tt.value : tt.value
    })
  /** Module `mod`'s default export function, or a failure at `at` saying `why`. */
  const defaultOf = (mod: ts.Symbol | undefined, at: ts.Node, why: string): ts.FunctionLikeDeclaration => {
    const def = mod && checker.getExportsOfModule(mod).find((x) => x.escapedName === 'default')
    const d = aliased(def)
    if (d && ts.isFunctionDeclaration(d) && d.body) return d
    // `export default X` of a const resolves to X's declaration.
    const t =
      d && ts.isExportAssignment(d)
        ? calleeTarget(d.expression)
        : d && ts.isVariableDeclaration(d) && d.initializer && ts.getCombinedNodeFlags(d) & ts.NodeFlags.Const
          ? calleeTarget(d.initializer)
          : undefined
    if (t && !ts.isCallExpression(t)) return t
    return fail(at, why)
  }
  /** The default export a `lazy(() => import('./x'))` call loads. */
  const lazyTarget = (tag: ts.Node, call: ts.CallExpression): ts.FunctionLikeDeclaration => {
    const load = call.arguments[0] && unwrap(call.arguments[0])
    const body = load && (ts.isArrowFunction(load) || ts.isFunctionExpression(load)) ? load.body : undefined
    const imp = body && ts.isBlock(body) ? undefined : body && unwrap(body)
    const spec =
      imp && ts.isCallExpression(imp) && imp.expression.kind === ts.SyntaxKind.ImportKeyword
        ? imp.arguments[0]
        : undefined
    return defaultOf(
      spec && checker.getSymbolAtLocation(spec),
      tag,
      `"${text(tag)}" is a lazy component whose \`() => import('…')\` default export cannot be read`,
    )
  }
  /** The Tags a Layer-typed expression provides (`ROut`) and requires (`RIn`). */
  const layerTags = (at: ts.Node, t: ts.Type) => {
    if (isAny(t) || libId(t.getSymbol(), checker) !== 'effect/Layer#Layer')
      return fail(at, `"${text(at)}" is not a readable Layer`)
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
      if (d && ts.isVariableDeclaration(d) && d.initializer && ts.getCombinedNodeFlags(d) & ts.NodeFlags.Const)
        return calleeTarget(d.initializer)
    }
    return fail(expr, `"${text(expr)}" is a dynamic component; its declaration cannot be read`)
  }

  const stack = new Set<ts.Node>()
  /** A `function*` component: it `yield*`s its Effects and returns the element. */
  const isGeneratorFn = (f: ts.FunctionLikeDeclaration) =>
    (ts.isFunctionExpression(f) || ts.isFunctionDeclaration(f)) && !!f.asteriskToken
  /** What a component declaration renders: an Effect component's returns, or a generator component's `yield*`ed elements plus the elements it returns. */
  const rendered = (f: ts.FunctionLikeDeclaration): UiNode[] =>
    isGeneratorFn(f)
      ? [
          ...yields(f),
          // A returned plain node renders nothing to analyze; an unreadable one fails closed in `build`.
          ...bodyReturns(f)
            .filter((r) => {
              const t = checker.getTypeAtLocation(r)
              return !ts.isYieldExpression(unwrap(r)) && (isAny(t) || !!effectArgs(t))
            })
            .flatMap(build),
        ]
      : bodyReturns(f).flatMap(build)
  /** Every node an `Effect<Node>`-valued expression renders. */
  const build = (expr: ts.Expression): UiNode[] => guarded(() => read(expr))
  /** `f`'s nodes, or the `Unresolved` node for what it could not read. */
  const guarded = (f: () => UiNode[]): UiNode[] => {
    try {
      return f()
    } catch (err) {
      if (!(err instanceof Unreadable)) throw err
      return [{ kind: 'unresolved', message: err.message, ...loc(err.node) }]
    }
  }
  const read = (expr: ts.Expression): UiNode[] => {
    const e = unwrap(expr)
    if (ts.isConditionalExpression(e)) return [...build(e.whenTrue), ...build(e.whenFalse)]
    if (
      ts.isBinaryExpression(e) &&
      [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(
        e.operatorToken.kind,
      )
    )
      return [
        ...(e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ? [] : build(e.left)),
        ...build(e.right),
      ]
    if (ts.isArrayLiteralExpression(e))
      return e.elements.flatMap((x) => build(ts.isSpreadElement(x) ? x.expression : x))
    if (ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e)) return jsx(e)
    const t = checker.getTypeAtLocation(e)
    if (isAny(t)) return fail(e, `"${text(e)}" is typed ${checker.typeToString(t)}; what it renders cannot be read`)
    if (ts.isIdentifier(e) || ts.isPropertyAccessExpression(e)) {
      const d = declOf(e)
      if (d && ts.isVariableDeclaration(d) && d.initializer && ts.getCombinedNodeFlags(d) & ts.NodeFlags.Const)
        return build(d.initializer)
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
      const body = e.arguments
        .map(unwrap)
        .find((x): x is ts.FunctionExpression => ts.isFunctionExpression(x) && !!x.asteriskToken)
      return body ? yields(body) : fail(e, `Effect.gen "${text(e)}" has no readable function* body`)
    }
    if (id === 'effect/Effect#all') return e.arguments.flatMap(list)
    if (id?.startsWith('effect/')) {
      // A leaf like Effect.succeed(node); an Effect-producing callback hides what it renders.
      const ts_ = e.arguments.map((x) => checker.getTypeAtLocation(x))
      if (
        ts_.some(
          (x) => !effectArgs(x) && x.getCallSignatures().some((s) => effectArgs(checker.getReturnTypeOfSignature(s))),
        )
      )
        return fail(e, `"${text(e)}" renders through a callback; its tree cannot be read`)
      return e.arguments.filter((x, i) => isNodeEffect(ts_[i]!)).flatMap(build)
    }
    if (id) return fail(e, `"${text(e)}" is not a component`)
    const target = calleeTarget(e.expression)
    if (ts.isCallExpression(target)) {
      if (calleeOf(target) === 'ui/component#fromReact' && target.arguments[0]) {
        const props = e.arguments[0] && unwrap(e.arguments[0])
        const given =
          props && ts.isObjectLiteralExpression(props)
            ? props.properties.map((p) => [p, propType(p)] as const)
            : props
              ? [[props, checker.getTypeAtLocation(props)] as const]
              : []
        return [guest(e, text(e.expression), target.arguments[0], given)]
      }
      return fail(e.expression, `"${text(e.expression)}" is a dynamic component; its declaration cannot be read`)
    }
    if (stack.has(target)) return component(e, text(e.expression), () => [])
    stack.add(target)
    try {
      return component(e, text(e.expression), () => rendered(target))
    } finally {
      stack.delete(target)
    }
  }
  /** An attribute's value expression (`a="x"` or `a={x}`). */
  const attrOf = (open: ts.JsxOpeningLikeElement, name: string): ts.Expression | undefined => {
    const a = open.attributes.properties.find(
      (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === name,
    )
    return a?.initializer && (ts.isJsxExpression(a.initializer) ? a.initializer.expression : a.initializer)
  }
  /** What a `{expr}` between JSX tags renders: Effect components through branches and `.map`; plain values render nothing to analyze. */
  const embedded = (x: ts.Expression): UiNode[] => {
    const e = unwrap(x)
    if (ts.isConditionalExpression(e)) return [...embedded(e.whenTrue), ...embedded(e.whenFalse)]
    if (
      ts.isBinaryExpression(e) &&
      [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(
        e.operatorToken.kind,
      )
    )
      return [
        ...(e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ? [] : embedded(e.left)),
        ...embedded(e.right),
      ]
    if (ts.isArrayLiteralExpression(e))
      return e.elements.flatMap((m) => embedded(ts.isSpreadElement(m) ? m.expression : m))
    const t = checker.getTypeAtLocation(e)
    if (isNodeEffect(t)) return build(e)
    const item = checker.isArrayType(t) ? checker.getTypeArguments(t as ts.TypeReference)[0] : undefined
    return item && isNodeEffect(item) ? list(e) : []
  }
  /** A JSX element or fragment: host elements are transparent, `Provider` / `Boundary` become `provide` / `catch`, anything else a component. */
  const jsx = (e: ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment): UiNode[] => {
    const open = ts.isJsxElement(e) ? e.openingElement : ts.isJsxSelfClosingElement(e) ? e : undefined
    const kids = (ts.isJsxSelfClosingElement(e) ? [] : e.children).flatMap((c) =>
      ts.isJsxText(c) ? [] : ts.isJsxExpression(c) ? (c.expression ? embedded(c.expression) : []) : build(c),
    )
    if (!open) return kids
    const tag = open.tagName
    if (ts.isIdentifier(tag) && /^[a-z]/.test(tag.text))
      return [...open.attributes.properties.flatMap(closure), ...kids]
    const id = libId(checker.getSymbolAtLocation(tag), checker)
    if (id === 'ui/jsx-runtime#Fragment' || id === 'ui/jsx-runtime#Portal') return kids
    if (id === 'ui/pending#Pending') {
      // Transparent: children keep their R and E; the fallback renders beside them, so its components are siblings.
      const fb = attrOf(open, 'fallback')
      return [...kids, ...(fb ? embedded(fb) : [])]
    }
    if (id === 'ui/jsx-runtime#Provider') {
      const layer = attrOf(open, 'layer') ?? fail(e, '<Provider> needs a layer')
      const { provides, requires } = layerTags(layer, checker.getTypeAtLocation(layer))
      return [{ kind: 'provide', provides, requires, children: kids, ...loc(e) }]
    }
    if (id === 'ui/jsx-runtime#Boundary') {
      const t = attrOf(open, 'tag') ?? fail(e, '<Boundary> needs a tag')
      const tt = ts.isStringLiteralLike(unwrap(t))
        ? { value: (unwrap(t) as ts.StringLiteralLike).text }
        : checker.getTypeAtLocation(t)
      if (!('value' in tt)) return fail(t, `Boundary tag "${text(t)}" is not a string literal`)
      const fb = attrOf(open, 'fallback')
      const target = fb && calleeTarget(fb)
      // The fallback renders outside the boundary: its components are siblings, not caught children.
      return [
        { kind: 'catch', tag: tt.value, children: kids, ...loc(e) },
        ...(target && !ts.isCallExpression(target) ? rendered(target) : []),
      ]
    }
    if (ts.isJsxNamespacedName(tag)) return fail(tag, `"${text(tag)}" is not a component`)
    // A library component (the router's `Link`, say) holds no app code: its type gives its E / R.
    const library = !!id || external(declOf(tag))
    const target = library ? undefined : calleeTarget(tag)
    const sig = checker.getTypeAtLocation(tag).getCallSignatures()[0]
    if (!sig) return fail(tag, `"${text(tag)}" is not a component`)
    const type = checker.getReturnTypeOfSignature(sig)
    if (!target) return component(e, text(tag), () => kids, type)
    if (ts.isCallExpression(target) && calleeOf(target) === 'ui/lazy#lazy') {
      // The loaded component's tree gives its E / R; the type adds `LazyLoadError`, and its `any` members are that tree's.
      const loaded = lazyTarget(tag, target)
      return component(e, text(tag), () => [...rendered(loaded), ...kids], type).slice(0, 1)
    }
    if (ts.isCallExpression(target)) {
      if (calleeOf(target) !== 'ui/component#fromReact' || !target.arguments[0])
        return fail(tag, `"${text(tag)}" is a dynamic component; its declaration cannot be read`)
      const given = open.attributes.properties.flatMap((p) => {
        const v = ts.isJsxSpreadAttribute(p)
          ? p.expression
          : p.initializer && (ts.isJsxExpression(p.initializer) ? p.initializer.expression : p.initializer)
        return v ? [[p, checker.getTypeAtLocation(v)] as const] : []
      })
      return [guest(e, text(tag), target.arguments[0], given)]
    }
    if (stack.has(target)) return component(e, text(tag), () => kids, type)
    stack.add(target)
    try {
      return component(e, text(tag), () => [...rendered(target), ...kids], type)
    } finally {
      stack.delete(target)
    }
  }
  /** A handler slot: an `onXxx` event attribute, or a form's `action`. */
  const isHandlerAttr = (name: string) => /^on[A-Z]/.test(name) || name === 'action'
  /** A host `onXxx` or `action` closure: a node carrying its `R` and its `E`, which no enclosing `Catch` can handle. */
  const closure = (p: ts.JsxAttributeLike): UiNode[] => {
    const v =
      ts.isJsxAttribute(p) && isHandlerAttr(p.name.getText()) && p.initializer && ts.isJsxExpression(p.initializer)
        ? p.initializer.expression
        : undefined
    if (!v) return []
    try {
      const t = checker.getTypeAtLocation(v)
      if (isAny(t))
        return fail(
          v,
          `Event closure "${text(v)}" is typed ${checker.typeToString(t)}; its errors and requirements cannot be named`,
        )
      const sigs = t.getCallSignatures()
      const direct = !sigs.length && effectArgs(t) // an Effect value as the handler
      if (!sigs.length && !direct) return []
      const ret = sigs.length === 1 ? checker.getReturnTypeOfSignature(sigs[0]!) : direct ? t : undefined
      // A plain function returning nothing has no errors and no requirements.
      const args =
        ret && ret.flags & (ts.TypeFlags.Void | ts.TypeFlags.Undefined)
          ? ([[], [], []] as [ts.Type[], ts.Type[], ts.Type[]])
          : ret && effectArgs(ret)
      if (!args || [...args[1], ...args[2]].some(isAny))
        return fail(v, `Event closure "${text(v)}" does not return a readable Effect`)
      return [
        {
          kind: 'component',
          name: `${text(v)} closure`,
          guest: false,
          closure: true,
          requires: tagNames(v, args[2], 'requires'),
          errors: errorTags(v, args[1]),
          children: [],
          ...loc(v),
        },
      ]
    } catch (err) {
      if (!(err instanceof Unreadable)) throw err
      return [{ kind: 'unresolved', message: err.message, ...loc(err.node) }]
    }
  }
  const propType = (p: ts.ObjectLiteralElementLike) =>
    checker.getTypeAtLocation(ts.isPropertyAssignment(p) ? p.initializer : ts.isSpreadAssignment(p) ? p.expression : p)
  /** A component node carrying `e`'s `E` / `R`; unreadable members fail closed at `e` without hiding its children. */
  const component = (
    e: ts.Node,
    name: string,
    children: () => UiNode[],
    type = checker.getTypeAtLocation(e),
  ): UiNode[] => {
    const args = effectArgs(type)
    if (!args || !isNode(args[0])) return fail(e, `"${text(e)}" does not return Effect<Node, E, R>`)
    const own: UiNode[] = [...args[1], ...args[2]].some(isAny)
      ? [
          {
            kind: 'unresolved',
            message: `"${text(e)}" has E / R typed any or unknown; its errors and requirements cannot be named`,
            ...loc(e),
          },
        ]
      : []
    return [
      {
        kind: 'component',
        name,
        guest: false,
        requires: tagNames(
          e,
          args[2].filter((m) => !isAny(m)),
          'requires',
        ),
        errors: errorTags(
          e,
          args[1].filter((m) => !isAny(m)),
        ),
        children: children(),
        ...loc(e),
      },
      ...own,
    ]
  }
  /** Members of a rendered list: array literals through const bindings, and `.map` callbacks' returns. */
  const list = (expr: ts.Expression): UiNode[] => {
    const e = unwrap(expr)
    if (ts.isArrayLiteralExpression(e)) return read(e)
    if (
      ts.isCallExpression(e) &&
      ts.isPropertyAccessExpression(e.expression) &&
      ['map', 'flatMap'].includes(e.expression.name.text) &&
      !calleeOf(e)
    ) {
      const cb = e.arguments[0] && calleeTarget(e.arguments[0])
      if (cb && !ts.isCallExpression(cb))
        return bodyReturns(cb).flatMap(e.expression.name.text === 'map' ? build : list)
    }
    if (ts.isIdentifier(e)) {
      const d = declOf(e)
      if (d && ts.isVariableDeclaration(d) && d.initializer && ts.getCombinedNodeFlags(d) & ts.NodeFlags.Const)
        return list(d.initializer)
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
        if (isAny(t))
          out.push({
            kind: 'unresolved',
            message: `yield* "${text(n.expression)}" is typed ${checker.typeToString(t)}`,
            ...loc(n.expression),
          })
        else if (isNodeEffect(t)) out.push(...build(n.expression))
      }
      ts.forEachChild(n, walk)
    }
    if (fn.body) ts.forEachChild(fn.body, walk)
    return out
  }
  /** A `fromReact` guest: Effect components in its props or in its React body are its (illegal) children. */
  const guest = (
    at: ts.Node,
    name: string,
    cmp: ts.Expression,
    given: ReadonlyArray<readonly [ts.Node, ts.Type]>,
  ): UiNode => {
    const inside: UiNode[] = []
    const found = (n: ts.Node) =>
      inside.push({ kind: 'component', name: text(n), guest: false, requires: [], errors: [], children: [], ...loc(n) })
    /** Whether a prop value's type holds an Effect component anywhere: nested objects, arrays and tuples included. */
    const carries = (t: ts.Type, at: ts.Node, seen = new Set<ts.Type>()): boolean => {
      if (isAny(t))
        return fail(
          at,
          `Guest prop "${text(at)}" is typed ${checker.typeToString(t)}; whether it carries an Effect component cannot be read`,
        )
      if (seen.has(t)) return false
      seen.add(t)
      if (isEffectComponent(t)) return true
      if (t.isUnion() || t.isIntersection()) return t.types.some((m) => carries(m, at, seen))
      if (checker.isArrayType(t) || checker.isTupleType(t))
        return checker.getTypeArguments(t as ts.TypeReference).some((m) => carries(m, at, seen))
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
    const library = external(d)
    if (d && ts.isClassDeclaration(d) && !library) body = d
    else if (!library) {
      try {
        const target = calleeTarget(cmp)
        if (ts.isCallExpression(target))
          fail(cmp, `React component "${text(cmp)}" is computed; its body cannot be read`)
        body = target
      } catch (err) {
        if (!(err instanceof Unreadable)) throw err
        inside.push({ kind: 'unresolved', message: err.message, ...loc(err.node) })
      }
    }
    const scan = (n: ts.Node): void => {
      const tagName = ts.isJsxElement(n)
        ? n.openingElement.tagName
        : ts.isJsxSelfClosingElement(n)
          ? n.tagName
          : undefined
      if (tagName && isEffectComponent(checker.getTypeAtLocation(tagName))) found(n)
      else if (ts.isCallExpression(n) && isNodeEffect(checker.getTypeAtLocation(n))) found(n)
      ts.forEachChild(n, scan)
    }
    if (body) ts.forEachChild(body, scan)
    else if (!library && !inside.some((n) => n.kind === 'unresolved'))
      inside.push({
        kind: 'unresolved',
        message: `React component "${text(cmp)}" has no readable declaration`,
        ...loc(cmp),
      })
    return { kind: 'component', name, guest: true, requires: [], errors: [], children: inside, ...loc(at) }
  }

  const trees: ComponentTree[] = []
  const nonResumable: AnalyzeError[] = []
  const notResumable = (n: ts.Node, message: string) =>
    nonResumable.push(analyzeError(NON_RESUMABLE_HANDLER, message, loc(n)))
  /** A handler reference at `at` (declared by `d`) must be a top-level `const h = defineHandler('literal', ...)`. */
  const checkHandlerRef = (at: ts.Node, d: ts.Declaration | undefined) => {
    // A top-level `const h = defineHandler(...)` or `export default defineHandler(...)`, possibly imported.
    const init =
      d &&
      ts.isVariableDeclaration(d) &&
      d.initializer &&
      ts.isVariableStatement(d.parent.parent) &&
      ts.isSourceFile(d.parent.parent.parent) &&
      ts.getCombinedNodeFlags(d) & ts.NodeFlags.Const
        ? unwrap(d.initializer)
        : d && ts.isExportAssignment(d) && ts.isSourceFile(d.parent)
          ? unwrap(d.expression)
          : undefined
    if (!init || !ts.isCallExpression(init) || calleeOf(init) !== 'ui/handler#defineHandler')
      notResumable(at, `Handler "${text(at)}" is not a reference to a top-level const defineHandler(...)`)
    else if (!init.arguments[0] || !ts.isStringLiteralLike(unwrap(init.arguments[0])))
      notResumable(at, `Handler "${text(at)}" has a non-literal id`)
  }
  /** An `on(node, { event: h })` entry must name a top-level `const h = defineHandler('literal', ...)`. */
  const checkOn = (call: ts.CallExpression) => {
    const map = call.arguments[1] && unwrap(call.arguments[1])
    if (!map || !ts.isObjectLiteralExpression(map))
      return map && notResumable(map, `on() handlers "${text(map)}" are not an object literal`)
    for (const p of map.properties) {
      const v = ts.isPropertyAssignment(p) ? unwrap(p.initializer) : undefined
      checkHandlerRef(
        p,
        ts.isShorthandPropertyAssignment(p)
          ? aliased(checker.getShorthandAssignmentValueSymbol(p))
          : v && (ts.isIdentifier(v) || ts.isPropertyAccessExpression(v))
            ? declOf(v)
            : undefined,
      )
    }
  }
  /** A JSX `onXxx={h}` (or `action={h}`) whose value is a `Handler` (not a closure) is a resumable handler: same rule as `on()`. */
  const checkJsxHandler = (attr: ts.JsxAttribute) => {
    const init = attr.initializer
    const v = init && ts.isJsxExpression(init) && init.expression ? unwrap(init.expression) : undefined
    if (
      !v ||
      !isHandlerAttr(attr.name.getText()) ||
      libId(checker.getTypeAtLocation(v).getSymbol(), checker) !== 'ui/handler#Handler'
    )
      return
    checkHandlerRef(attr, ts.isIdentifier(v) || ts.isPropertyAccessExpression(v) ? declOf(v) : undefined)
  }
  /** An expression through shorthand properties and `const` bindings to the object literal it names. */
  const objectOf = (e: ts.Node | undefined): ts.ObjectLiteralExpression | undefined => {
    if (e && ts.isShorthandPropertyAssignment(e)) {
      const d = checker.getShorthandAssignmentValueSymbol(e)?.valueDeclaration
      return d && ts.isVariableDeclaration(d) && ts.getCombinedNodeFlags(d) & ts.NodeFlags.Const
        ? objectOf(d.initializer)
        : undefined
    }
    const x = e && (ts.isPropertyAssignment(e) ? e.initializer : ts.isExpression(e) ? e : undefined)
    const u = x && unwrap(x)
    if (!u) return undefined
    if (ts.isObjectLiteralExpression(u)) return u
    const d = ts.isIdentifier(u) ? declOf(u) : undefined
    return d && ts.isVariableDeclaration(d) && ts.getCombinedNodeFlags(d) & ts.NodeFlags.Const
      ? objectOf(d.initializer)
      : undefined
  }
  /** A `resume({ layer, handlers })` root: one child per handler carrying the `R` of its loader's `default`. */
  const resumeRoot = (n: ts.CallExpression): ComponentTree => {
    const opts = n.arguments[0] && unwrap(n.arguments[0])
    try {
      if (!opts) return fail(n, 'resume() needs { layer, handlers }')
      const sym = checker.getTypeAtLocation(opts).getProperty('layer') ?? fail(opts, 'resume() options have no layer')
      const provides = layerTags(opts, checker.getTypeOfSymbolAtLocation(sym, opts)).provides
      // The last `handlers` wins, through `...spread` of readable const objects.
      const find = (o: ts.ObjectLiteralExpression | undefined): ts.ObjectLiteralElementLike | undefined =>
        o?.properties.reduce<ts.ObjectLiteralElementLike | undefined>(
          (hit, p) =>
            ts.isSpreadAssignment(p)
              ? (find(objectOf(p.expression)) ?? hit)
              : p.name?.getText() === 'handlers'
                ? p
                : hit,
          undefined,
        )
      const hp = find(objectOf(opts))
      const map = objectOf(hp)
      const children: UiNode[] = []
      if (!map) notResumable(hp ?? opts, 'resume() handlers are not a readable object literal')
      else
        for (const p of map.properties) {
          const name = `handler ${p.name?.getText() ?? text(p)}`
          const loader = p.name ? checker.getTypeAtLocation(p.name) : undefined
          const ret =
            loader?.getCallSignatures()[0] &&
            checker.getAwaitedType(checker.getReturnTypeOfSignature(loader.getCallSignatures()[0]!))
          const def = ret && !isAny(ret) ? ret.getProperty('default') : undefined
          const run = def && checker.getTypeOfSymbolAtLocation(def, p).getProperty('run')
          const sig = run && checker.getTypeOfSymbolAtLocation(run, p).getCallSignatures()[0]
          const args = sig && effectArgs(checker.getReturnTypeOfSignature(sig))
          if (!args || args[2].some(isAny)) notResumable(p, `Loader "${text(p)}" has no readable default Handler type`)
          else
            children.push({
              kind: 'component',
              name,
              guest: false,
              requires: args[2].map(tagName),
              errors: [],
              children: [],
              ...loc(p),
            })
        }
      return {
        provides,
        root: { kind: 'component', name: 'resume', guest: false, requires: [], errors: [], children, ...loc(n) },
        ...loc(n),
      }
    } catch (err) {
      if (!(err instanceof Unreadable)) throw err
      return { provides: [], root: { kind: 'unresolved', message: err.message, ...loc(err.node) }, ...loc(n) }
    }
  }
  /** A named property of an object literal (the last one wins, as at runtime). */
  const prop = (o: ts.ObjectLiteralExpression, name: string) =>
    o.properties.filter((p) => p.name?.getText() === name).at(-1)
  /** The object literal a router argument names: through const bindings and `router({ ... })`. */
  const routerOf = (e: ts.Expression): ts.ObjectLiteralExpression => {
    const u = unwrap(e)
    if (ts.isObjectLiteralExpression(u)) return u
    if (ts.isCallExpression(u) && calleeOf(u) === 'router/resolve#router' && u.arguments[0])
      return routerOf(u.arguments[0])
    const d = ts.isIdentifier(u) ? declOf(u) : undefined
    if (d && ts.isVariableDeclaration(d) && d.initializer && ts.getCombinedNodeFlags(d) & ts.NodeFlags.Const)
      return routerOf(d.initializer)
    return fail(e, `Router "${text(e)}" is not a router({ table, pages, notFound }) literal; its pages cannot be read`)
  }
  /** A page's `render` (or the router's `notFound`): a component node over what the function renders. */
  const renderNode = (p: ts.ObjectLiteralElementLike, name: string): UiNode[] => {
    const value = ts.isShorthandPropertyAssignment(p)
      ? aliased(checker.getShorthandAssignmentValueSymbol(p))
      : undefined
    const fn = ts.isMethodDeclaration(p)
      ? p
      : ts.isPropertyAssignment(p)
        ? calleeTarget(p.initializer)
        : value && ts.isFunctionDeclaration(value) && value.body
          ? value
          : value &&
              ts.isVariableDeclaration(value) &&
              value.initializer &&
              ts.getCombinedNodeFlags(value) & ts.NodeFlags.Const
            ? calleeTarget(value.initializer)
            : fail(p, `"${text(p)}" is not a readable render function`)
    if (ts.isCallExpression(fn)) return fail(fn, `"${text(fn)}" is a computed render function; its tree cannot be read`)
    return renderOf(p, fn, name)
  }
  /** A component node at `at` for render function `fn`, over what it renders. */
  const renderOf = (at: ts.Node, fn: ts.FunctionLikeDeclaration, name: string): UiNode[] => {
    const sig = checker.getSignatureFromDeclaration(fn)
    if (!sig) return fail(at, `"${text(at)}" has no readable signature`)
    return component(at, name, () => rendered(fn), checker.getReturnTypeOfSignature(sig))
  }
  /** A page's `loaders` (typed `t`, written at `p`): one node carrying the `R` of every loader's `load`. */
  const loadersNode = (p: ts.Node, t: ts.Type, name: string): UiNode => {
    const items =
      checker.isArrayType(t) || checker.isTupleType(t) ? checker.getTypeArguments(t as ts.TypeReference) : []
    const requires = items.flatMap(members).flatMap((m) => {
      const load = m.getProperty('load')
      const args = load && effectArgs(checker.getTypeOfSymbolAtLocation(load, p))
      return args ? tagNames(p, args[2], 'requires') : fail(p, `Loaders "${text(p)}" have no readable load Effect`)
    })
    return { kind: 'component', name: `${name} loaders`, guest: false, requires, errors: [], children: [], ...loc(p) }
  }
  /** The symbol router property `p` names when it is an import from `virtual:sleekstack/routes`. */
  const routesImport = (p: ts.ObjectLiteralElementLike | undefined): ts.Symbol | undefined => {
    const init = p && ts.isPropertyAssignment(p) ? unwrap(p.initializer) : undefined
    const sym =
      p && ts.isShorthandPropertyAssignment(p)
        ? checker.getShorthandAssignmentValueSymbol(p)
        : init && ts.isIdentifier(init)
          ? checker.getSymbolAtLocation(init)
          : undefined
    const d = sym?.declarations?.[0]
    return d &&
      ts.isImportSpecifier(d) &&
      (d.parent.parent.parent.moduleSpecifier as ts.StringLiteral).text === ROUTES_MODULE
      ? sym
      : undefined
  }
  /** The `routes.gen.d.ts` declaration of a `virtual:sleekstack/routes` import; without one nothing is guessed. */
  const declared = (p: ts.Node, sym: ts.Symbol): ts.VariableDeclaration => {
    const d = aliased(sym)
    return d && ts.isVariableDeclaration(d) && d.getSourceFile().isDeclarationFile
      ? d
      : fail(
          p,
          `"${text(p)}" is imported from ${ROUTES_MODULE}, which has no routes.gen.d.ts declaration; run vite to write it`,
        )
  }
  /** The route files under `dir` that ui-vite makes routes: not `.d.ts`, no `_`-prefixed segment (ADR 0050). */
  const routeFiles = (dir: string) =>
    fs
      .readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((f) => ROUTE_FILE.test(f) && !f.endsWith('.d.ts') && !f.split(path.sep).some((s) => s.startsWith('_')))
      .map((f) => path.join(dir, f).split(path.sep).join('/'))
  /**
   * The route modules `routes.gen.d.ts` types `pages` from (`Page<typeof import('./x')>`), checked against the route
   * files beside it: a declaration that names a missing file or misses a route file fails, naming both.
   */
  const filePages = (p: ts.Node, sym: ts.Symbol) => {
    const d = declared(p, sym)
    const file = path.basename(d.getSourceFile().fileName)
    const members =
      d.type && ts.isTypeLiteralNode(d.type) ? d.type.members : fail(d, `${file} types pages as no object of routes`)
    const missing: string[] = []
    const pages = members.flatMap((m) => {
      const t = ts.isPropertySignature(m) ? m.type : undefined
      const arg = t && ts.isTypeReferenceNode(t) ? t.typeArguments?.[0] : undefined
      if (!arg || !ts.isImportTypeNode(arg) || !m.name)
        return fail(m, `${file} types page "${text(m)}" as no Page<typeof import('./route-file')>`)
      const module = checker.getTypeFromTypeNode(arg).getSymbol()
      const source = module?.valueDeclaration
      if (!module || !source || !ts.isSourceFile(source)) {
        missing.push(arg.argument.getText())
        return []
      }
      return [{ name: `page ${m.name.getText()}`, module, file: source.fileName, at: m }]
    })
    const listed = new Set(pages.map((x) => x.file))
    const unlisted = routeFiles(path.dirname(d.getSourceFile().fileName)).filter((f) => !listed.has(f))
    if (missing.length || unlisted.length)
      fail(
        d,
        `${file} disagrees with the route files${missing.length ? `; it names missing ${missing.join(', ')}` : ''}${
          unlisted.length ? `; it misses ${unlisted.map((f) => path.relative(root, f)).join(', ')}` : ''
        }; run vite to rewrite it`,
      )
    return pages
  }
  /** A route module's nodes: its default export as the page's render, and its `loaders` export. */
  const filePage = (name: string, module: ts.Symbol, at: ts.Node): UiNode[] => {
    const loaders = aliased(checker.getExportsOfModule(module).find((x) => x.escapedName === 'loaders'))
    return [
      ...guarded(() => {
        const fn = defaultOf(module, at, `The route module of "${text(at)}" has no readable default export component`)
        return renderOf(fn.name ?? fn, fn, name)
      }),
      ...(loaders ? guarded(() => [loadersNode(loaders, checker.getTypeAtLocation(loaders), name)]) : []),
    ]
  }
  /** `notFound` imported from `virtual:sleekstack/routes`: the root `_notFound` file beside its declaration. */
  const fileNotFound = (p: ts.ObjectLiteralElementLike, sym: ts.Symbol): UiNode[] => {
    const dir = path.dirname(declared(p, sym).getSourceFile().fileName)
    const sf = program
      .getSourceFiles()
      .find((f) => path.dirname(f.fileName) === dir && /^_notFound\.[jt]sx?$/.test(path.basename(f.fileName)))
    const module = sf && checker.getSymbolAtLocation(sf)
    if (!module) return fail(p, `"${text(p)}" is declared in routes.gen.d.ts but ${dir} has no _notFound file`)
    const fn = defaultOf(module, p, `${sf!.fileName} has no readable default export component`)
    return renderOf(fn.name ?? fn, fn, 'notFound')
  }
  /**
   * A `startRouter(router, { layer })` / `handle(router, request, { layer })` root: one child per page (its render and
   * loaders) and one for `notFound`, under the entry's layer plus what the router provides; its redirect and not-found
   * are the router's own control flow.
   */
  const routerRoot = (n: ts.CallExpression, opts: ts.Expression | undefined): ComponentTree => {
    try {
      const sym = opts && checker.getTypeAtLocation(opts).getProperty('layer')
      const layer = sym && checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(sym, opts))
      // `Route` is provided around matched pages only, never around `notFound`.
      const provides = [...(layer ? layerTags(opts!, layer).provides : []), 'Loaders', 'Transfer']
      const def = routerOf(n.arguments[0] ?? fail(n, `"${text(n)}" has no router`))
      const pp = prop(def, 'pages')
      const fromFiles = routesImport(pp)
      const nf = prop(def, 'notFound') ?? fail(def, 'Router has no notFound page')
      const nfFromFiles = routesImport(nf)
      const route = (at: ts.Node, nodes: UiNode[]): UiNode => ({
        kind: 'provide',
        provides: ['Route'],
        requires: [],
        children: nodes,
        ...loc(at),
      })
      const pages = fromFiles
        ? filePages(pp!, fromFiles).map(({ name, module, at }) => route(at, filePage(name, module, at)))
        : (objectOf(pp) ?? fail(def, 'Router pages are not a readable object literal')).properties.flatMap((p) => {
            const name = `page ${p.name?.getText() ?? text(p)}`
            const page = objectOf(p)
            if (!page) return guarded(() => fail(p, `Page "${text(p)}" is not a readable object literal`))
            const render = prop(page, 'render')
            const loaders = prop(page, 'loaders')
            return route(p, [
              ...guarded(() => (render ? renderNode(render, name) : fail(p, `"${text(p)}" has no render`))),
              ...(loaders ? guarded(() => [loadersNode(loaders, propType(loaders), name)]) : []),
            ])
          })
      const children: UiNode[] = [
        ...pages,
        ...guarded(() => (nfFromFiles ? fileNotFound(nf, nfFromFiles) : renderNode(nf, 'notFound'))),
      ]
      const root: UiNode = Object.keys(ROUTER_CONTROL).reduce<UiNode>(
        (inner, tag) => ({ kind: 'catch', tag: ROUTER_ERROR + tag, children: [inner], ...loc(n) }),
        { kind: 'component', name: text(n.expression), guest: false, requires: [], errors: [], children, ...loc(n) },
      )
      return { provides, root, ...loc(n) }
    } catch (err) {
      if (!(err instanceof Unreadable)) throw err
      return { provides: [], root: { kind: 'unresolved', message: err.message, ...loc(err.node) }, ...loc(n) }
    }
  }
  const rules: AnalyzeError[] = []
  /** `useLocal`, `useEffect`, `useRef`, `useDerivedAtom`, `useAction`, `useOptimistic`, `useDeferredAtom`, `useDraft`, `useRecord` and a record's `useDraft` must be a statement-level `yield*` in a component's generator body (`function*` or `Effect.gen`), before any `return`; anything else fails closed. */
  const checkSlot = (call: ts.CallExpression, hook = 'useLocal') => {
    const bad = (why: string) =>
      rules.push(
        analyzeError(
          'ConditionalSlot',
          `${hook} "${text(call)}" ${why}; slots must run in the same order on every run`,
          loc(call),
        ),
      )
    let n: ts.Node = call.parent
    while (ts.isParenthesizedExpression(n)) n = n.parent
    if (!ts.isYieldExpression(n) || !n.asteriskToken) return bad('is not a plain yield* in a component generator body')
    n = n.parent
    if (ts.isVariableDeclaration(n) && n.parent.parent && ts.isVariableStatement(n.parent.parent)) n = n.parent.parent
    else if (!ts.isExpressionStatement(n))
      return bad('is not called as its own statement (inside a condition, loop or expression)')
    const stmt = n as ts.Statement
    const block = stmt.parent
    const fn = block.parent
    if (
      !ts.isBlock(block) ||
      !fn ||
      !(ts.isFunctionExpression(fn) || ts.isFunctionDeclaration(fn)) ||
      !fn.asteriskToken ||
      fn.body !== block
    )
      return bad('is inside a condition, loop or nested block')
    const gen = fn.parent
    // A component's own `function*` (it renders a Node), or the `function*` of a component's `Effect.gen`.
    const own = (() => {
      const sig = checker.getSignatureFromDeclaration(fn)
      return !!sig && isNodeEffect(checker.getReturnTypeOfSignature(sig))
    })()
    if (
      !own &&
      (!ts.isCallExpression(gen) ||
        calleeOf(gen) !== 'effect/Effect#gen' ||
        !isNodeEffect(checker.getTypeAtLocation(gen)))
    )
      return bad("is not in a component's generator body (a helper or nested function)")
    let returned = false
    const scan = (x: ts.Node): void => {
      if (ts.isFunctionLike(x)) return
      if (ts.isReturnStatement(x)) returned = true
      ts.forEachChild(x, scan)
    }
    for (const s of block.statements) {
      if (s === stmt) break
      scan(s)
    }
    if (returned) bad('runs after an earlier return')
  }
  /** Each element a child-position `.map` / `.flatMap` / `Array.from` callback returns carries a `key`. */
  const checkKeys = (call: ts.CallExpression) => {
    const callee = call.expression
    if (!ts.isPropertyAccessExpression(callee)) return
    const from = callee.getText() === 'Array.from'
    if (!from && (!['map', 'flatMap'].includes(callee.name.text) || calleeOf(call))) return
    const cb = call.arguments[from ? 1 : 0] && unwrap(call.arguments[from ? 1 : 0]!)
    if (!cb || !(ts.isArrowFunction(cb) || ts.isFunctionExpression(cb))) return
    // Child position: through branches, arrays and spreads up to JSX children or an Effect.all argument.
    let p: ts.Node = call
    while (
      ts.isParenthesizedExpression(p.parent) ||
      ts.isConditionalExpression(p.parent) ||
      ts.isBinaryExpression(p.parent) ||
      ts.isArrayLiteralExpression(p.parent) ||
      ts.isSpreadElement(p.parent)
    )
      p = p.parent
    const child =
      (ts.isJsxExpression(p.parent) && !ts.isJsxAttribute(p.parent.parent)) ||
      (ts.isCallExpression(p.parent) && p.parent.expression !== p && calleeOf(p.parent) === 'effect/Effect#all')
    if (!child) return
    const flat = !from && callee.name.text === 'flatMap'
    const check = (x: ts.Expression): void => {
      const e = unwrap(x)
      if (ts.isConditionalExpression(e)) return (check(e.whenTrue), check(e.whenFalse))
      if (
        ts.isBinaryExpression(e) &&
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(e.operatorToken.kind)
      )
        return (check(e.left), check(e.right))
      if (flat && ts.isArrayLiteralExpression(e))
        return e.elements.forEach((m) => check(ts.isSpreadElement(m) ? m.expression : m))
      const open = ts.isJsxElement(e) ? e.openingElement : ts.isJsxSelfClosingElement(e) ? e : undefined
      if (
        ts.isJsxFragment(e) ||
        (open && !open.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.getText() === 'key'))
      )
        rules.push(
          analyzeError('MissingKey', `"${text(e)}" is rendered by "${text(callee)}" without a key prop`, loc(e)),
        )
    }
    bodyReturns(cb).forEach(check)
  }
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && calleeOf(n) === 'ui/reactive#useLocal') checkSlot(n)
    if (ts.isCallExpression(n) && calleeOf(n) === 'ui/reactive#useEffect') checkSlot(n, 'useEffect')
    if (ts.isCallExpression(n) && calleeOf(n) === 'ui/reactive#useRef') checkSlot(n, 'useRef')
    if (ts.isCallExpression(n) && calleeOf(n) === 'ui/reactive#useDerivedAtom') checkSlot(n, 'useDerivedAtom')
    if (ts.isCallExpression(n) && calleeOf(n) === 'ui/reactive#useAction') checkSlot(n, 'useAction')
    if (ts.isCallExpression(n) && calleeOf(n) === 'ui/reactive#useOptimistic') checkSlot(n, 'useOptimistic')
    if (ts.isCallExpression(n) && calleeOf(n) === 'ui/reactive#useDeferredAtom') checkSlot(n, 'useDeferredAtom')
    if (ts.isCallExpression(n) && modelCalleeOf(n) === 'model/draft#useDraft') checkSlot(n, 'useDraft')
    if (ts.isCallExpression(n) && modelCalleeOf(n) === 'model/adapter#useRecord') checkSlot(n, 'useRecord')
    if (ts.isCallExpression(n) && modelCalleeOf(n) === 'model/record#useDraft') checkSlot(n, 'record.useDraft')
    if (ts.isCallExpression(n)) checkKeys(n)
    if (ts.isCallExpression(n) && calleeOf(n) === 'ui/handler#on') checkOn(n)
    if (ts.isJsxAttribute(n)) checkJsxHandler(n)
    if (ts.isCallExpression(n) && calleeOf(n) === 'ui/resume#resume') trees.push(resumeRoot(n))
    if (ts.isCallExpression(n) && calleeOf(n) === 'router/history#startRouter')
      trees.push(routerRoot(n, n.arguments[1]))
    if (ts.isCallExpression(n) && calleeOf(n) === 'router/server#handle') trees.push(routerRoot(n, n.arguments[2]))
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
        root =
          nodes.length === 1
            ? nodes[0]!
            : {
                kind: 'component',
                name: text(app),
                guest: false,
                requires: [],
                errors: [],
                children: nodes,
                ...loc(app),
              }
      } catch (err) {
        if (!(err instanceof Unreadable)) throw err
        root = { kind: 'unresolved', message: err.message, ...loc(err.node) }
      }
      trees.push({ provides, root, ...loc(n) })
    }
    ts.forEachChild(n, visit)
  }
  for (const sf of program.getSourceFiles()) {
    if (
      !sf.isDeclarationFile &&
      program.getRootFileNames().includes(sf.fileName) &&
      !TEST_FILE.test(path.relative(root, sf.fileName))
    )
      visit(sf)
  }

  const errors: AnalyzeError[] = [...nonResumable, ...rules]
  for (const t of trees) check(t.root, new Set([...t.provides, UI_STORE]), new Set(), errors)
  return { trees, errors: [...new Map(errors.map((e) => [`${e.code}|${e.file}:${e.line}|${e.message}`, e])).values()] }
}

/**
 * Reports each missing Tag / uncaught error at the deepest node carrying it (a parent's type repeats its
 * children's). Returns the Tags and error tags already reported below.
 */
function check(
  n: UiNode,
  provided: ReadonlySet<string>,
  caught: ReadonlySet<string>,
  out: AnalyzeError[],
): Set<string> {
  const at = { file: n.file, line: n.line, column: n.column, endLine: n.endLine, endColumn: n.endColumn }
  if (n.kind === 'unresolved') return (out.push(analyzeError('Unresolved', n.message, at)), new Set())
  if (n.kind === 'component' && n.guest) {
    for (const c of n.children) {
      if (c.kind === 'unresolved') check(c, provided, caught, out)
      else
        out.push(
          analyzeError(
            'EffectInsideReact',
            `Effect component "${c.kind === 'component' ? c.name : ''}" is rendered under the React guest "${n.name}"`,
            { file: c.file, line: c.line, column: c.column, endLine: c.endLine, endColumn: c.endColumn },
          ),
        )
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
    out.push(
      analyzeError(
        'MissingDependency',
        `${who} requires "${r}", but no enclosing Provide or root (mount / resume / startRouter / handle) layer provides it`,
        at,
      ),
    )
  }
  for (const e of n.kind === 'component' ? n.errors : []) {
    // A `Catch` / `Boundary` matches by `_tag`, so it handles the router's control flow too.
    const handled = caught.has(e) || caught.has(e.replace(ROUTER_ERROR, ''))
    if ((!(n.kind === 'component' && n.closure) && handled) || below.has(`E:${e}`)) continue
    below.add(`E:${e}`)
    out.push(analyzeError('UnhandledError', `${who} can fail with "${e}", but no enclosing Catch handles it`, at))
  }
  return below
}
