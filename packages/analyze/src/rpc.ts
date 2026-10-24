/**
 * packages/analyze/src/rpc.ts
 *
 * The RPC pass (ADR 0054): every `*.rpc.ts` file under the server directory as one Server Service of its exported
 * functions, and the RPC Manifest (the server directory's `rpc.ts`) wrapping Controller Methods as Server Services; all
 * read through the shared signature reader. Their Tag names share one namespace with hand-written `ServerService` ids,
 * Layer File outputs and `serverFn` ids (`RpcNameCollision`).
 */

import * as path from 'node:path'
import ts from 'typescript'
import { CONTROLLER, type ControllerMethodName, controllerRoute, METHODS, signatureOf } from './controllers'
import { analyzeError } from './errorCodes'
import { libId, programOf, unwrap } from './extract'
import { readLayerFiles } from './layerFiles'
import type { AnalyzeCode, AnalyzeError, Location } from './model'
import {
  analyzeServerServices,
  contextKey,
  locationOf,
  membersOf,
  programSourcesOf,
  readSignature,
  sourcesOf,
} from './serverServices'
import { type MethodSchema, NotSerializable, ServerOnlyReference, Unreadable } from './typeSchema'

const RPC_FILE = /\.rpc\.ts$/
const MANIFEST = 'rpc.ts'
const OPTIONS: ReadonlySet<string> = new Set(['wrap', 'bodyLimit', 'origins', 'service'])
const NAME = /^[A-Za-z][A-Za-z0-9]*$/
const ENTRY = new RegExp(`^(${METHODS.join('|')}) (\\S+)$`)
const SERVER_FN = 'start/serverFn#serverFn'
const CLIENT = 'virtual:sleek/rpc'

export interface RpcMethod {
  readonly name: string
  readonly location: Location
  /** The parameter's type; undefined for a method without one. */
  readonly input: ts.Type | undefined
  /** `A`, `E` and `R` of the method's `Effect.Effect<A, E, R>`. */
  readonly success: ts.Type
  readonly error: ts.Type
  readonly requires: ts.Type
  /** The input as the wire carries it (a printed `number` is a plain number), the success and the tagged errors. */
  readonly schema: MethodSchema
  /** The Controller Method a Manifest entry wraps. */
  readonly controller?: { readonly route: string; readonly method: ControllerMethodName }
}

export interface RpcServiceDecl {
  /** The Tag name, also the wire id prefix `<name>.<method>`. */
  readonly name: string
  /** The RPC File, or the Manifest for a wrapped service; relative to the tsconfig directory. */
  readonly file: string
  readonly location: Location
  /** By name. */
  readonly methods: readonly RpcMethod[]
}

export interface RpcReport {
  /** RPC File services, then Manifest services, each by name. */
  readonly services: readonly RpcServiceDecl[]
  readonly errors: readonly AnalyzeError[]
  /** The checker the method types belong to. */
  readonly checker: ts.TypeChecker
}

/** The Tag name of an RPC File: its basename without `.rpc.ts`, words split at `-`, `_` and `.`, each capitalised. */
const derivedName = (file: string) =>
  path
    .basename(file)
    .replace(RPC_FILE, '')
    .split(/[-_.]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')

/**
 * `serverDir` (default `server`) and `controllersDir` (default `<serverDir>/routes`) are relative to the tsconfig
 * directory.
 */
export function analyzeRpc(opts: {
  readonly project: string
  readonly serverDir?: string
  readonly controllersDir?: string
}): RpcReport {
  const { root, program, checker } = programOf(opts.project)
  const serverDir = path.resolve(root, opts.serverDir ?? 'server')
  const controllersDir = opts.controllersDir ? path.resolve(root, opts.controllersDir) : path.join(serverDir, 'routes')
  const sources = sourcesOf(program, root)
  const errors: AnalyzeError[] = []
  const report = (code: AnalyzeCode, n: ts.Node, message: string) =>
    errors.push(analyzeError(code, message, locationOf(root, n)))
  const rel = (sf: ts.SourceFile) => path.relative(root, sf.fileName)
  const resolve = (s: ts.Symbol) => (s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s)
  const exportsOf = (sf: ts.SourceFile) => {
    const module = checker.getSymbolAtLocation(sf)
    return module ? checker.getExportsOfModule(module) : []
  }
  const keyOf = (t: ts.Type) => contextKey(t, checker)
  const isResponse = (t: ts.Type) =>
    t.getSymbol()?.getName() === 'Response' &&
    !!t.getSymbol()?.declarations?.some((d) => program.isSourceFileDefaultLibrary(d.getSourceFile()))

  /**
   * `sig` read for the RPC face; `label` names the method in each message, reported at `at` (a Manifest entry) or,
   * for an RPC File, where the signature is wrong.
   */
  const readMethod = (label: string, sig: ts.SignatureDeclaration, at?: ts.Node) => {
    const shape = (n: ts.Node, why: string) => void report('RpcMethodShape', at ?? n, `${label} ${why}`)
    const ret = sig.type && checker.getTypeFromTypeNode(sig.type)
    const [success] =
      ret && (ret as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference
        ? checker.getTypeArguments(ret as ts.TypeReference)
        : []
    if (success && isResponse(success))
      return shape(sig.type!, 'returns a Response; a wrapped method returns its value, or write an RPC File')
    const read = readSignature({ program, checker, root, serverDir }, sig, { requires: 'any' })
    if (read instanceof ServerOnlyReference)
      return void report(
        'ServerFileInClientGraph',
        at ?? read.at,
        `${label} ${read.why}: the generated client imports it, ${CLIENT} -> ${read.file}`,
      )
    if (read instanceof Unreadable) return shape(read.at, read.why)
    if (read instanceof NotSerializable)
      return void report(
        'ServerServiceTypeNotSerializable',
        at ?? sig,
        `${label}: ${read.path} has type "${read.text}", which is not serializable (${read.why})`,
      )
    return read
  }

  /** The signature of an RPC File export as written, or why its form is not supported. */
  const rpcSignatureOf = (decl: ts.Declaration | undefined): ts.SignatureDeclaration | string => {
    const form = 'is not a function declaration or an arrow or function expression assigned to an exported const'
    const init =
      decl &&
      ts.isVariableDeclaration(decl) &&
      ts.isVariableDeclarationList(decl.parent) &&
      decl.parent.flags & ts.NodeFlags.Const
        ? decl.initializer
        : undefined
    const sig =
      decl && ts.isFunctionDeclaration(decl)
        ? decl
        : init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
          ? init
          : undefined
    if (!sig) return form
    if (sig.typeParameters) return 'is generic; write out its types'
    if (ts.getCombinedModifierFlags(sig) & ts.ModifierFlags.Async) return 'is async; return an `Effect.Effect<A, E, R>`'
    const param = sig.parameters[0]
    if (param?.dotDotDotToken) return 'takes a rest parameter; take one parameter'
    if (param && !param.type) return 'has a parameter without a written type'
    return sig
  }

  const services: Array<RpcServiceDecl & { readonly at: ts.Node }> = []
  const byName = (a: { readonly name: string }, b: { readonly name: string }) => (a.name < b.name ? -1 : 1)

  for (const sf of sources.filter((s) => RPC_FILE.test(s.fileName))) {
    const under = path.relative(serverDir, sf.fileName)
    if (path.isAbsolute(under) || under.split(/[\\/]/)[0] === '..') continue
    const exported = exportsOf(sf).filter((e) => resolve(e).flags & ts.SymbolFlags.Value)
    const fileShape = (n: ts.Node, why: string) => void report('ServerFileShape', n, `RPC File "${rel(sf)}" ${why}`)
    const service = exported.find((e) => e.name === 'service')
    let name = derivedName(sf.fileName)
    let at: ts.Node = sf
    if (service) {
      const decl = resolve(service).valueDeclaration
      const init = decl && ts.isVariableDeclaration(decl) ? decl.initializer : undefined
      at = service.declarations?.[0] ?? sf
      if (!init || !ts.isStringLiteralLike(init)) {
        fileShape(at, "exports a `service` that is not a string literal; write `export const service = 'Name'`")
        continue
      }
      name = init.text
    }
    if (!NAME.test(name)) {
      fileShape(at, `names its service "${name}", which is not of the form [A-Za-z][A-Za-z0-9]*; export \`service\``)
      continue
    }
    const methods: RpcMethod[] = []
    for (const e of exported) {
      const value = resolve(e)
      // Options are read by the runtime; a non-function export is not a method.
      if (OPTIONS.has(e.name) || !checker.getTypeOfSymbol(value).getCallSignatures().length) continue
      const label = `RPC method "${name}.${e.name}"`
      const decl = value.valueDeclaration
      const sig = rpcSignatureOf(decl)
      if (typeof sig === 'string') {
        report('RpcMethodShape', decl ?? e.declarations?.[0] ?? sf, `${label} ${sig}`)
        continue
      }
      const read = readMethod(label, sig)
      if (read) methods.push({ name: e.name, location: locationOf(root, sig), ...read })
    }
    services.push({ name, file: rel(sf), location: locationOf(root, at), at, methods: methods.sort(byName) })
  }

  /** Each Controller by route name. */
  const controllers = new Map<string, ts.SourceFile>()
  for (const sf of sources.filter((s) => CONTROLLER.test(s.fileName)))
    try {
      const route = controllerRoute(controllersDir, sf.fileName)
      if (route) controllers.set(route.route, sf)
    } catch {
      // The Controller pass reports it.
    }

  const manifest = sources.find((sf) => path.resolve(sf.fileName) === path.join(serverDir, MANIFEST))
  if (manifest) {
    const notLiteral = (n: ts.Node, why: string) =>
      void report('ServerFileShape', n, `RPC Manifest "${rel(manifest)}" ${why}`)
    const assignment = manifest.statements.find(
      (s): s is ts.ExportAssignment => ts.isExportAssignment(s) && !s.isExportEquals,
    )
    const value = assignment && unwrap(assignment.expression)
    // `rpc(table, options)` or the table itself.
    const table = value && ts.isCallExpression(value) ? value.arguments[0] && unwrap(value.arguments[0]) : value
    const keyText = (n: ts.PropertyName) => (ts.isIdentifier(n) || ts.isStringLiteral(n) ? n.text : undefined)
    if (!table || !ts.isObjectLiteralExpression(table))
      notLiteral(
        assignment ?? manifest,
        "default export is not an object literal `{ Service: { method: 'VERB route' } }`",
      )
    else
      for (const p of table.properties) {
        const name = p.name && keyText(p.name)
        const entries = ts.isPropertyAssignment(p) ? unwrap(p.initializer) : undefined
        if (!name || !entries || !ts.isObjectLiteralExpression(entries)) {
          notLiteral(p, "has an entry that is not `Service: { method: 'VERB route' }` with a written name")
          continue
        }
        if (!NAME.test(name)) {
          notLiteral(p.name!, `names a service "${name}", which is not of the form [A-Za-z][A-Za-z0-9]*`)
          continue
        }
        const methods: RpcMethod[] = []
        for (const m of entries.properties) {
          const method = m.name && keyText(m.name)
          const spec = ts.isPropertyAssignment(m) ? unwrap(m.initializer) : undefined
          const [, verb, route] = (spec && ts.isStringLiteralLike(spec) && ENTRY.exec(spec.text)) || []
          if (!method || !spec || !verb || !route) {
            notLiteral(m, `has an entry of "${name}" that is not \`method: 'VERB route'\`, a string literal`)
            continue
          }
          const label = `RPC Manifest entry "${name}.${method}" (${verb} ${route})`
          const controller = controllers.get(route)
          if (!controller) {
            report('RpcRouteUnknown', spec, `${label} names a route no Controller under the routes directory serves`)
            continue
          }
          const target = exportsOf(controller).find((e) => e.name === verb)
          const decl =
            target && resolve(target).flags & ts.SymbolFlags.Value ? resolve(target).valueDeclaration : undefined
          if (!decl) {
            report('RpcRouteUnknown', spec, `${label}: Controller "${rel(controller)}" does not export ${verb}`)
            continue
          }
          const sig = signatureOf(decl)
          if (!sig) {
            report('RpcMethodShape', spec, `${label} wraps a method that is not written as a function`)
            continue
          }
          // Reported once, at the entry: the Controller pass reports the method's own shape.
          const read = readMethod(label, sig, spec)
          if (read)
            methods.push({
              name: method,
              location: locationOf(root, spec),
              ...read,
              controller: { route, method: verb as ControllerMethodName },
            })
        }
        services.push({
          name,
          file: rel(manifest),
          location: locationOf(root, p.name!),
          at: p.name!,
          methods: methods.sort(byName),
        })
      }
  }

  // A generated Layer is provided by the composed Layer, not part of it: no generated method requires another.
  const generated = new Set(services.map((s) => s.name))
  const out = services.map((s) => ({
    ...s,
    methods: s.methods.filter((m) => {
      const tag = membersOf(m.requires)
        .map(keyOf)
        .find((k) => generated.has(k))
      if (!tag) return true
      errors.push(
        analyzeError(
          'RpcMethodShape',
          `RPC method "${s.name}.${m.name}" requires the generated "${tag}"; a generated service cannot require another`,
          m.location,
        ),
      )
      return false
    }),
  }))

  checkNamespace()
  return {
    services: out
      .sort((a, b) => Number(!RPC_FILE.test(a.file)) - Number(!RPC_FILE.test(b.file)) || byName(a, b))
      .map(({ at: _, ...s }) => s),
    errors,
    checker,
  }

  /** R7: one Context key per name across the five sources, each collision reported once naming both. */
  function checkNamespace() {
    type Named = { readonly name: string; readonly source: string; readonly at: Location; readonly kind: string }
    const where = (l: Location) => `${l.file}:${l.line}`
    const named: Named[] = []
    // A Layer File providing a hand-written Server Service's implementation provides that same Tag.
    const declared = new Set<string>()
    for (const s of analyzeServerServices({ project: opts.project, serverDir: opts.serverDir }).services) {
      declared.add(where(s.location))
      named.push({
        name: s.id,
        source: `ServerService "${s.name}" (${where(s.location)})`,
        at: s.location,
        kind: 'service',
      })
    }
    for (const f of readLayerFiles(programSourcesOf(program, root), checker))
      if ('provides' in f)
        for (const t of f.provides) {
          const decl = t.getSymbol()?.valueDeclaration
          if (decl && declared.has(where(locationOf(root, decl)))) continue
          named.push({ name: keyOf(t), source: `Layer File "${rel(f.sf)}"`, at: locationOf(root, f.at), kind: 'layer' })
        }
    const visit = (n: ts.Node): void => {
      if (ts.isCallExpression(n) && libId(checker.getSymbolAtLocation(n.expression), checker) === SERVER_FN) {
        const id = n.arguments[0] && checker.getTypeAtLocation(n.arguments[0])
        const at = locationOf(root, n)
        if (id?.isStringLiteral())
          named.push({ name: id.value, source: `serverFn (${where(at)})`, at, kind: 'serverFn' })
      }
      ts.forEachChild(n, visit)
    }
    sources.forEach(visit)
    for (const s of services) {
      const kind = RPC_FILE.test(s.file) ? 'rpc' : 'manifest'
      const source = kind === 'rpc' ? `RPC File "${s.file}"` : `RPC Manifest "${s.file}" (${where(s.location)})`
      named.push({ name: s.name, source, at: s.location, kind })
    }
    // A duplicate within one hand-written kind has its own diagnostic (ServerServiceFileShape, LayerFileConflict, DuplicateServerFn).
    const own = new Set(['service', 'layer', 'serverFn'])
    const first = new Map<string, Named>()
    for (const n of named) {
      const other = first.get(n.name)
      if (!other) first.set(n.name, n)
      else if (!(other.kind === n.kind && own.has(n.kind)))
        errors.push(
          analyzeError('RpcNameCollision', `Tag name "${n.name}" is used by ${other.source} and ${n.source}`, n.at),
        )
    }
  }
}
