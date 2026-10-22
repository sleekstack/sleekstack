/**
 * packages/analyze/src/serverServices.ts
 *
 * The Server Service pass (ADR 0051): every `class X extends ServerService('Id')<X, Shape>() {}`, found by the
 * declaration its base call resolves to (so imports through re-exports and barrels work), with its file and method
 * shape checked. The declarations carry the raw method types for the Type-to-Schema step. Also reports each server-only
 * file (`SERVER_ONLY`) reachable from a browser entry (`ServerFileInClientGraph`).
 */

import * as path from 'node:path'
import ts from 'typescript'
import { analyzeError } from './errorCodes'
import { libId, programOf, TEST_FILE } from './extract'
import type { AnalyzeCode, AnalyzeError, Location } from './model'
import { type MethodSchema, methodSchema, NotSerializable, taggedErrorBase } from './typeSchema'

const SERVER_SERVICE = 'start/service#ServerService'
const EFFECT = 'effect/Effect#Effect'
const START = 'start/start#start'
const LAYER = 'effect/Layer#Layer'
const CLIENT_MODULE = 'virtual:sleek/server'

/**
 * The server-only files (R12): none may be reachable from a browser entry. A file is server-only by its kind, the suffix
 * before its extension (`*.server.ts`, `*.controller.ts`), anywhere; or by a reserved name (`_defaults.ts`) under the
 * server directory. `sleekstack check` and the Vite plugin both read this one list, through `isServerOnly`.
 */
export const SERVER_ONLY: { readonly kinds: readonly string[]; readonly reserved: readonly string[] } = {
  kinds: ['server', 'controller'],
  reserved: ['_defaults'],
}

/** Whether `file` is server-only (`SERVER_ONLY`) in an app whose server directory is `serverDir`; both absolute. */
export const isServerOnly = (file: string, serverDir: string): boolean => {
  const stem = /^(.+?)\.[cm]?[jt]sx?$/.exec(path.basename(file))?.[1]
  if (!stem) return false
  if (SERVER_ONLY.kinds.some((kind) => stem.endsWith(`.${kind}`))) return true
  const under = path.relative(serverDir, file)
  return SERVER_ONLY.reserved.includes(stem) && !path.isAbsolute(under) && under.split(/[\\/]/)[0] !== '..'
}

export interface ServerServiceMethod {
  readonly name: string
  readonly location: Location
  /** The parameter's type; undefined for a method without one. */
  readonly input: ts.Type | undefined
  /** `A`, `E` of the method's `Effect.Effect<A, E, never>`. */
  readonly success: ts.Type
  readonly error: ts.Type
  /** The three types as the generator's Schema description. */
  readonly schema: MethodSchema
}

export interface ServerServiceDecl {
  /** The literal Tag id, `ServerService('<id>')`. */
  readonly id: string
  /** The class name. */
  readonly name: string
  readonly location: Location
  readonly methods: readonly ServerServiceMethod[]
}

export interface ServerServiceReport {
  readonly services: readonly ServerServiceDecl[]
  readonly errors: readonly AnalyzeError[]
  /** The checker the method types belong to. */
  readonly checker: ts.TypeChecker
}

/** `serverDir`: the server directory, relative to the tsconfig directory (default `server`); it scopes the reserved names of `SERVER_ONLY`. */
export function analyzeServerServices(opts: {
  readonly project: string
  readonly serverDir?: string
}): ServerServiceReport {
  const { root, program, checker } = programOf(opts.project)
  const serverDir = path.resolve(root, opts.serverDir ?? 'server')
  const errors: AnalyzeError[] = []
  const services: ServerServiceDecl[] = []
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
  const report = (code: AnalyzeCode, n: ts.Node, message: string) => errors.push(analyzeError(code, message, loc(n)))

  const callee = (c: ts.CallExpression) => libId(checker.getSymbolAtLocation(c.expression), checker)
  const extendsOf = (c: ts.ClassLikeDeclaration) =>
    c.heritageClauses?.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword)?.types[0]?.expression
  /** The `ServerService('...')` call of `class X extends ServerService('...')<X, Shape>() {}`. */
  const serviceCall = (c: ts.ClassLikeDeclaration): ts.CallExpression | undefined => {
    const ext = extendsOf(c)
    const inner = ext && ts.isCallExpression(ext) && ts.isCallExpression(ext.expression) ? ext.expression : undefined
    return inner && callee(inner) === SERVER_SERVICE ? inner : undefined
  }
  /** The `ServerService('...')` call heading `extends ServerService('...')<X, Shape>()`, the one form the reader follows. */
  const isServiceCallOfClass = (c: ts.CallExpression): boolean => {
    const outer = c.parent
    const heritage = outer?.parent
    return (
      !!outer &&
      ts.isCallExpression(outer) &&
      outer.expression === c &&
      !!heritage &&
      ts.isExpressionWithTypeArguments(heritage) &&
      heritage.expression === outer &&
      ts.isHeritageClause(heritage.parent) &&
      heritage.parent.token === ts.SyntaxKind.ExtendsKeyword
    )
  }
  const isTaggedError = (c: ts.ClassLikeDeclaration) => !!taggedErrorBase(c, checker)

  const hasAny = (n: ts.Node): boolean => n.kind === ts.SyntaxKind.AnyKeyword || !!ts.forEachChild(n, hasAny)
  const isAny = (t: ts.Type) => !!(t.flags & ts.TypeFlags.Any)

  const methodOf = (owner: string, shapeNode: ts.TypeNode, prop: ts.Symbol): ServerServiceMethod | undefined => {
    const at = prop.valueDeclaration ?? prop.declarations?.[0]
    const name = `${owner}.${prop.getName()}`
    const bad = (n: ts.Node, why: string) => {
      report('ServerServiceMethodShape', n, `Server Service method "${name}" ${why}`)
      return undefined
    }
    if (!at) return bad(shapeNode, 'has no declaration to read; write the shape as an object type')
    // The signature as written: a property typed with a function type, or a method signature with a return type.
    const sig = ts.isPropertySignature(at) && at.type && ts.isFunctionTypeNode(at.type) ? at.type : at
    if (!(ts.isFunctionTypeNode(sig) || ts.isMethodSignature(sig)) || !sig.type)
      return bad(at, 'needs an explicit function type `(input) => Effect.Effect<A, E>`')
    if (hasAny(sig)) return bad(sig, 'is typed with `any`; write out the types')
    if (sig.parameters.length > 1) return bad(sig.parameters[1]!, 'takes more than one parameter; pass one object')
    const param = sig.parameters[0]
    const input = param ? checker.getTypeAtLocation(param) : undefined
    const ret = checker.getTypeFromTypeNode(sig.type)
    if (libId(ret.aliasSymbol ?? ret.getSymbol(), checker) !== EFFECT)
      return bad(sig.type, 'does not return an `Effect.Effect<A, E>`')
    const [success, error, requires] = checker.getTypeArguments(ret as ts.TypeReference)
    if (!success || !error || !requires) return bad(sig.type, 'does not return an `Effect.Effect<A, E>`')
    if ([input, success, error, requires].some((t) => t && isAny(t)))
      return bad(sig, 'is typed with `any`; write out the types')
    if (!(requires.flags & ts.TypeFlags.Never))
      return bad(sig.type, `requires "${checker.typeToString(requires)}"; a Server Service method needs no services`)
    const schema = methodSchema({ program, checker, root }, { input, success, error })
    if (schema instanceof NotSerializable)
      return void report(
        'ServerServiceTypeNotSerializable',
        at,
        `Server Service method "${name}": ${schema.path} has type "${schema.text}", which is not serializable (${schema.why})`,
      )
    return { name: prop.getName(), location: loc(at), input, success, error, schema }
  }

  const serviceOf = (c: ts.ClassLikeDeclaration): void => {
    const call = serviceCall(c)!
    if (!ts.isSourceFile(c.parent))
      return void report(
        'Unresolvable',
        c,
        'A Server Service must be declared at the top level of its file, not dynamically',
      )
    if (!c.name) return void report('Unresolvable', c, 'An anonymous class cannot be a Server Service')
    const arg = call.arguments[0]
    const idType = arg && checker.getTypeAtLocation(arg)
    if (!arg || !idType?.isStringLiteral())
      return void report('Unresolvable', arg ?? call, `Server Service "${c.name.text}" has a non-literal Tag id`)
    const ext = call.parent as ts.CallExpression
    const shapeNode = ext.typeArguments?.[1]
    if (!shapeNode)
      return void report('ServerServiceMethodShape', ext, `Server Service "${c.name.text}" needs its method shape`)
    const shape = checker.getTypeFromTypeNode(shapeNode)
    if (isAny(shape))
      return void report('ServerServiceMethodShape', shapeNode, `Server Service "${c.name.text}" is typed with \`any\``)
    const methods = shape.getProperties().flatMap((p) => methodOf(idType.value, shapeNode, p) ?? [])
    services.push({ id: idType.value, name: c.name.text, location: loc(c), methods })
  }

  /** A file declaring a Server Service holds only imports, types, tagged error and Server Service classes. */
  const checkFile = (sf: ts.SourceFile, first: ts.ClassLikeDeclaration) => {
    const shape = (n: ts.Node, why: string) => report('ServerServiceFileShape', n, why)
    if (isServerOnly(sf.fileName, serverDir))
      shape(first, 'A Server Service contract is client-safe; it cannot sit in a server-only file')
    for (const s of sf.statements) {
      if (ts.isImportDeclaration(s)) {
        const target = checker.getSymbolAtLocation(s.moduleSpecifier)?.valueDeclaration
        if (target && ts.isSourceFile(target) && isServerOnly(target.fileName, serverDir))
          shape(s, `A Server Service contract file imports the server-only "${s.moduleSpecifier.getText()}"`)
      } else if (ts.isClassDeclaration(s) ? !(serviceCall(s) || isTaggedError(s)) : !isTypeOnly(s))
        shape(
          s,
          'A Server Service contract file holds only imports, types, Data.TaggedError, Schema.TaggedError and ServerService classes',
        )
    }
  }
  const isTypeOnly = (s: ts.Statement) =>
    ts.isTypeAliasDeclaration(s) ||
    ts.isInterfaceDeclaration(s) ||
    ts.isEmptyStatement(s) ||
    (ts.isExportDeclaration(s) && (s.isTypeOnly || !s.moduleSpecifier))

  const sources = program
    .getSourceFiles()
    .filter(
      (sf) =>
        !sf.isDeclarationFile &&
        !/[\\/]node_modules[\\/]/.test(sf.fileName) &&
        program.getRootFileNames().includes(sf.fileName) &&
        !TEST_FILE.test(path.relative(root, sf.fileName)),
    )
  for (const sf of sources) {
    const found: ts.ClassLikeDeclaration[] = []
    const stray: ts.CallExpression[] = []
    const walk = (n: ts.Node): void => {
      if ((ts.isClassDeclaration(n) || ts.isClassExpression(n)) && serviceCall(n)) found.push(n)
      else if (ts.isCallExpression(n) && callee(n) === SERVER_SERVICE && !isServiceCallOfClass(n)) stray.push(n)
      ts.forEachChild(n, walk)
    }
    walk(sf)
    // A `ServerService(...)` the reader cannot follow would otherwise vanish and leave an empty client.
    for (const call of stray)
      report(
        'Unresolvable',
        call,
        "A ServerService must be declared as `class X extends ServerService('Id')<X, Shape>() {}`; this construction cannot be read",
      )
    if (!found.length) continue
    checkFile(sf, found[0]!)
    found.forEach(serviceOf)
  }

  /** `start({ services, layer })`: each registered Tag needs an implementation in `layer`, as `start`'s own types require. */
  const checkStart = (call: ts.CallExpression, options: ts.ObjectLiteralExpression) => {
    const valueOf = (name: string) => {
      const p = options.properties.find((x) => x.name !== undefined && ts.isIdentifier(x.name) && x.name.text === name)
      return p && ts.isPropertyAssignment(p)
        ? p.initializer
        : p && ts.isShorthandPropertyAssignment(p)
          ? p.name
          : undefined
    }
    const services = valueOf('services')
    if (!services) return
    const entries = checker.getIndexTypeOfType(checker.getTypeAtLocation(services), ts.IndexKind.Number)
    if (!entries) return
    const tagsOf = (t: ts.Type) =>
      (t.isUnion() ? t.types : [t]).flatMap((m) => (m.flags & ts.TypeFlags.Object ? [m] : []))
    const required = tagsOf(entries).flatMap((entry) => {
      const id = checker.getTypeArguments(entry as ts.TypeReference)[0]
      return id && !(id.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) ? tagsOf(id) : []
    })
    const layer = valueOf('layer')
    const provided: ts.Type[] = []
    if (layer) {
      const type = checker.getTypeAtLocation(layer)
      if (libId(type.aliasSymbol ?? type.getSymbol(), checker) !== LAYER) return // a Layer it cannot read: leave it to `tsc`
      const out = checker.getTypeArguments(type as ts.TypeReference)[0]
      if (!out || out.flags & ts.TypeFlags.Any) return
      if (!(out.flags & ts.TypeFlags.Never)) provided.push(...(out.isUnion() ? out.types : [out]))
    }
    const have = new Set(provided.map((t) => t.getSymbol()))
    for (const tag of required)
      if (!have.has(tag.getSymbol()))
        report(
          'MissingDependency',
          call,
          `Server Service "${tag.getSymbol()?.getName() ?? checker.typeToString(tag)}" is registered in start({ services }) but start's layer does not provide it`,
        )
  }
  for (const sf of sources) {
    const visitStart = (n: ts.Node): void => {
      if (ts.isCallExpression(n) && callee(n) === START) {
        const options = n.arguments[0]
        if (options && ts.isObjectLiteralExpression(options)) checkStart(n, options)
      }
      ts.forEachChild(n, visitStart)
    }
    visitStart(sf)
  }

  serverFilesInClientGraph(program, sources, (n, message) => report('ServerFileInClientGraph', n, message), {
    root,
    serverDir,
  })

  const byId = new Map<string, ServerServiceDecl[]>()
  for (const s of services) byId.set(s.id, [...(byId.get(s.id) ?? []), s])
  for (const [id, same] of byId)
    if (same.length > 1)
      errors.push(
        analyzeError(
          'ServerServiceFileShape',
          `Server Service Tag id "${id}" is declared by several classes: ${same.map((s) => `${s.name} (${s.location.file}:${s.location.line})`).join(', ')}`,
          same[1]!.location,
        ),
      )
  return { services, errors, checker }
}

/** The specifiers `sf` imports values from (statically or dynamically), each with its statement; `import type` and imports of only types are erased, so left out. */
const valueImports = (sf: ts.SourceFile): Array<{ readonly spec: string; readonly at: ts.Node }> => {
  const out: Array<{ spec: string; at: ts.Node }> = []
  const typesOnly = (b: ts.NamedImportBindings | ts.NamedExportBindings | undefined) =>
    !!b &&
    (ts.isNamedImports(b) || ts.isNamedExports(b)) &&
    b.elements.length > 0 &&
    b.elements.every((e) => e.isTypeOnly)
  const visit = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n)) {
      const c = n.importClause
      if (!(c && (c.isTypeOnly || (!c.name && typesOnly(c.namedBindings)))) && ts.isStringLiteral(n.moduleSpecifier))
        out.push({ spec: n.moduleSpecifier.text, at: n })
    } else if (ts.isExportDeclaration(n)) {
      if (n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier) && !n.isTypeOnly && !typesOnly(n.exportClause))
        out.push({ spec: n.moduleSpecifier.text, at: n })
    } else {
      if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const arg = n.arguments[0]
        if (arg && ts.isStringLiteralLike(arg)) out.push({ spec: arg.text, at: n })
      }
      ts.forEachChild(n, visit)
    }
  }
  visit(sf)
  return out
}

/**
 * `ServerFileInClientGraph`: from every module importing `virtual:sleek/server` (a browser entry), walks the value
 * imports and reports each server-only file reached, once, at the importing statement with the shortest chain.
 */
const serverFilesInClientGraph = (
  program: ts.Program,
  sources: readonly ts.SourceFile[],
  report: (at: ts.Node, message: string) => void,
  { root, serverDir }: { readonly root: string; readonly serverDir: string },
) => {
  const resolve = (spec: string, from: ts.SourceFile) => {
    const file = ts.resolveModuleName(spec, from.fileName, program.getCompilerOptions(), ts.sys).resolvedModule
      ?.resolvedFileName
    const sf = file && program.getSourceFile(file)
    return sf && !sf.isDeclarationFile && !/[\\/]node_modules[\\/]/.test(sf.fileName) ? sf : undefined
  }
  const rel = (sf: ts.SourceFile) => path.relative(root, sf.fileName)
  const queue = sources.filter((sf) => valueImports(sf).some((i) => i.spec === CLIENT_MODULE))
  /** Each reached module's chain from its browser entry. */
  const chains = new Map(queue.map((sf) => [sf, [rel(sf)]]))
  for (let i = 0; i < queue.length; i++) {
    const from = queue[i]!
    for (const { spec, at } of valueImports(from)) {
      const to = resolve(spec, from)
      if (!to || chains.has(to)) continue
      const chain = [...chains.get(from)!, rel(to)]
      chains.set(to, chain)
      // Not walked further: what a server file imports is server code.
      if (isServerOnly(to.fileName, serverDir))
        report(at, `The server-only "${rel(to)}" is reachable from the browser: ${chain.join(' -> ')}`)
      else queue.push(to)
    }
  }
}
