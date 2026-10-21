/**
 * packages/analyze/src/serverServices.ts
 *
 * The Server Service pass (ADR 0051): every `class X extends ServerService('Id')<X, Shape>() {}`, found by the
 * declaration its base call resolves to (so imports through re-exports and barrels work), with its file and method
 * shape checked. The declarations carry the raw method types for the Type-to-Schema step.
 */

import * as path from 'node:path'
import ts from 'typescript'
import { analyzeError } from './errorCodes'
import { libId, programOf, TEST_FILE } from './extract'
import type { AnalyzeCode, AnalyzeError, Location } from './model'
import { type MethodSchema, methodSchema, NotSerializable, taggedErrorBase } from './typeSchema'

const SERVER_SERVICE = 'start/service#ServerService'
const EFFECT = 'effect/Effect#Effect'
const SERVER_FILE = /\.server\.[cm]?[jt]sx?$/

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

export function analyzeServerServices(opts: { readonly project: string }): ServerServiceReport {
  const { root, program, checker } = programOf(opts.project)
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

  /** A file declaring a Server Service holds only imports, types, `Data.TaggedError` and Server Service classes. */
  const checkFile = (sf: ts.SourceFile, first: ts.ClassLikeDeclaration) => {
    const shape = (n: ts.Node, why: string) => report('ServerServiceFileShape', n, why)
    if (SERVER_FILE.test(sf.fileName))
      shape(first, 'A Server Service contract is client-safe; it cannot sit in a `*.server.ts` file')
    for (const s of sf.statements) {
      if (ts.isImportDeclaration(s)) {
        const target = checker.getSymbolAtLocation(s.moduleSpecifier)?.valueDeclaration
        if (target && ts.isSourceFile(target) && SERVER_FILE.test(target.fileName))
          shape(s, `A Server Service contract file imports the server-only "${s.moduleSpecifier.getText()}"`)
      } else if (ts.isClassDeclaration(s) ? !(serviceCall(s) || isTaggedError(s)) : !isTypeOnly(s))
        shape(s, 'A Server Service contract file holds only imports, types, Data.TaggedError and ServerService classes')
    }
  }
  const isTypeOnly = (s: ts.Statement) =>
    ts.isTypeAliasDeclaration(s) ||
    ts.isInterfaceDeclaration(s) ||
    ts.isEmptyStatement(s) ||
    (ts.isExportDeclaration(s) && (s.isTypeOnly || !s.moduleSpecifier))

  for (const sf of program.getSourceFiles()) {
    if (
      sf.isDeclarationFile ||
      /[\\/]node_modules[\\/]/.test(sf.fileName) ||
      !program.getRootFileNames().includes(sf.fileName) ||
      TEST_FILE.test(path.relative(root, sf.fileName))
    )
      continue
    const found: ts.ClassLikeDeclaration[] = []
    const walk = (n: ts.Node): void => {
      if ((ts.isClassDeclaration(n) || ts.isClassExpression(n)) && serviceCall(n)) found.push(n)
      ts.forEachChild(n, walk)
    }
    walk(sf)
    if (!found.length) continue
    checkFile(sf, found[0]!)
    found.forEach(serviceOf)
  }

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
