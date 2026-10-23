/**
 * packages/analyze/src/controllers.ts
 *
 * The Controller pass (ADR 0053): every `*.controller.ts` file, its route (ADR 0050's path syntax, the one derivation
 * the Vite plugin shares) and its methods, read through the shared signature reader with the input rules of R4. The
 * services a method requires must come from the request services, `start({ layer })`, a Layer File or a `wrap` above it
 * (R3), and so must those a `wrap`'s result requires, from a `wrap` above that one.
 */

import * as path from 'node:path'
import ts from 'typescript'
import { analyzeError } from './errorCodes'
import { libId, programOf, unwrap } from './extract'
import { readLayerFiles } from './layerFiles'
import type { AnalyzeCode, AnalyzeError, Location } from './model'
import { layerOutputs, locationOf, membersOf, propertyOf, readSignature, sourcesOf, startCalls } from './serverServices'
import { NotSerializable, type TypeSchema, Unreadable } from './typeSchema'

const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const
export type ControllerMethodName = (typeof METHODS)[number]
const isMethod = (name: string): name is ControllerMethodName => (METHODS as readonly string[]).includes(name)
/** The methods that may declare a `body`. */
const BODY: ReadonlySet<string> = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const INPUT = ['params', 'query', 'body']
const CONTROLLER = /\.controller\.ts$/
const DEFAULTS = '_defaults.ts'
const EFFECT = 'effect/Effect#Effect'
/** The services `start` provides to every call (`RequestServices` of `@sleekstack/start`). */
const REQUEST_SERVICES: ReadonlySet<string> = new Set(
  ['Request', 'Cookies', 'ResponseHeaders', 'ResponseStatus'].map((name) => `start/services#${name}`),
)

const STATIC = /^[\w.~-]+$/
const PARAM = /^\[(\w+)\]$/
const OPTIONAL = /^\[\[(\w+)\]\]$/
const SPLAT = /^\[\.\.\.(\w+)\]$/
const GROUP = /^\([\w.~-]+\)$/

export interface ControllerRoute {
  /** The path under the Controllers directory without `.controller.ts`, such as `articles/[slug]` or `(admin)/index`. */
  readonly route: string
  /** The URL pattern in route table syntax, such as `/articles/:slug`. */
  readonly pattern: string
}

/**
 * The route of the Controller `file` under `controllersDir` (both absolute), in ADR 0050's syntax: `[id]` is `:id`,
 * `[[id]]` is `:id?`, `[...rest]` is `*rest`, a `(group)` adds no segment, and an `index` file is its directory's path;
 * the route name keeps `(group)` and `index`. Undefined under a file or directory starting with `_` (not a route).
 * Throws naming the file when it is outside `controllersDir`, a segment has none of the forms, or an optional or splat
 * segment is not the last one.
 */
export const controllerRoute = (controllersDir: string, file: string): ControllerRoute | undefined => {
  const invalid = (why: string): never => {
    throw new Error(`sleekstack: invalid Controller file ${file}: ${why}`)
  }
  const rel = path.relative(controllersDir, file)
  if (path.isAbsolute(rel) || rel.split(/[\\/]/)[0] === '..')
    return invalid(`it is outside the Controllers directory ${controllersDir}`)
  const route = rel.split(/[\\/]/).join('/').replace(CONTROLLER, '')
  const segments = route.split('/')
  if (segments.some((s) => s.startsWith('_'))) return undefined
  if (segments.at(-1) === 'index') segments.pop()
  const parts = segments
    .map((segment) => {
      const [, param] = PARAM.exec(segment) ?? []
      if (param) return `:${param}`
      const [, optional] = OPTIONAL.exec(segment) ?? []
      if (optional) return `:${optional}?`
      const [, splat] = SPLAT.exec(segment) ?? []
      if (splat) return `*${splat}`
      if (GROUP.test(segment)) return ''
      if (STATIC.test(segment)) return segment
      return invalid(`segment "${segment}" is neither a name, a [param], a [[param]], a [...splat] nor a (group)`)
    })
    .filter((s) => s !== '')
  if (parts.slice(0, -1).some((s) => s.endsWith('?') || s.startsWith('*')))
    return invalid('an optional or splat segment must be the last one')
  return { route, pattern: `/${parts.join('/')}` }
}

export interface ControllerMethod {
  readonly name: ControllerMethodName
  readonly location: Location
  /** The services the method requires: its `R`. */
  readonly requires: ts.Type
  /**
   * `input` is `void` or an object of `params`, `query` and `body`, whose `number` and `boolean` under `params` and
   * `query` carry `codec: 'string'`. `success` is undefined when the return type is not written.
   */
  readonly schema: { readonly input: TypeSchema; readonly success: TypeSchema | undefined }
}

export interface ControllerDecl extends ControllerRoute {
  /** The file, relative to the tsconfig directory. */
  readonly file: string
  /** The methods read without an error, in the order GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS. */
  readonly methods: readonly ControllerMethod[]
}

export interface ControllerReport {
  readonly controllers: readonly ControllerDecl[]
  readonly errors: readonly AnalyzeError[]
  /** The checker the `requires` types belong to. */
  readonly checker: ts.TypeChecker
}

/**
 * `serverDir` (default `server`) and `controllersDir` (default `<serverDir>/routes`) are relative to the tsconfig
 * directory.
 */
export function analyzeControllers(opts: {
  readonly project: string
  readonly serverDir?: string
  readonly controllersDir?: string
}): ControllerReport {
  const { root, program, checker } = programOf(opts.project)
  const serverDir = path.resolve(root, opts.serverDir ?? 'server')
  const controllersDir = opts.controllersDir ? path.resolve(root, opts.controllersDir) : path.join(serverDir, 'routes')
  const errors: AnalyzeError[] = []
  const report = (code: AnalyzeCode, n: ts.Node, message: string) =>
    errors.push(analyzeError(code, message, locationOf(root, n)))
  const sources = sourcesOf(program, root)

  const resolve = (s: ts.Symbol) => (s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s)
  const exportsOf = (sf: ts.SourceFile) => {
    const module = checker.getSymbolAtLocation(sf)
    return module ? checker.getExportsOfModule(module) : []
  }
  /** `R` of an `Effect.Effect<A, E, R>` type, as its members. */
  const requiresOf = (t: ts.Type) => {
    if (libId(t.aliasSymbol ?? t.getSymbol(), checker) !== EFFECT) return undefined
    const r = checker.getTypeArguments(t as ts.TypeReference)[2]
    return r && membersOf(r)
  }

  const tagsOf = (types: readonly ts.Type[]) => types.flatMap((t) => t.getSymbol() ?? [])

  /**
   * The `wrap` export of `sf`: the services it discharges (its `next` requirements minus its result's) and those its
   * result requires (an untyped `any` requires nothing).
   */
  const wrapOf = (sf: ts.SourceFile) => {
    const wrap = exportsOf(sf).find((e) => e.name === 'wrap')
    const [sig] = wrap ? checker.getTypeOfSymbol(resolve(wrap)).getCallSignatures() : []
    const next = sig?.parameters[0]
    const inner = next && requiresOf(checker.getTypeOfSymbol(next))
    const outer = sig && requiresOf(checker.getReturnTypeOfSignature(sig))
    const kept = new Set(tagsOf(outer ?? []))
    return {
      at: wrap?.declarations?.[0] ?? sf,
      discharged: inner && outer ? tagsOf(inner).filter((s) => !kept.has(s)) : [],
      requires: (outer ?? []).filter((t) => !(t.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))),
    }
  }
  /** `dir` relative to `from` as its segments; undefined when it is not under `from`. */
  const under = (from: string, dir: string) => {
    const rel = path.relative(from, dir)
    return path.isAbsolute(rel) || rel.split(/[\\/]/)[0] === '..' ? undefined : rel.split(/[\\/]/).filter(Boolean)
  }
  const defaults = new Map(
    sources.filter((sf) => path.basename(sf.fileName) === DEFAULTS).map((sf) => [path.dirname(sf.fileName), sf]),
  )
  /** Every `wrap` around `sf`, outer first: each `_defaults.ts` from the server directory down, then its own. */
  const wraps = (sf: ts.SourceFile) => {
    const dirs = under(serverDir, path.dirname(sf.fileName))
    const chain = dirs
      ? [serverDir, ...dirs.map((_, i) => path.join(serverDir, ...dirs.slice(0, i + 1)))].flatMap(
          (dir) => defaults.get(dir) ?? [],
        )
      : []
    return [...chain, sf].map(wrapOf)
  }
  /** What the app provides to every call: `start({ layer })` and the Layer Files. */
  const fromApp = new Set([
    ...startCalls(sources, checker).flatMap(({ options }) => {
      const layer = options && propertyOf(options, 'layer')
      return tagsOf((layer && layerOutputs(layer, checker)) ?? [])
    }),
    ...readLayerFiles(sources, checker).flatMap((f) => ('provides' in f ? tagsOf(f.provides) : [])),
  ])

  /** The Encoded type of the Schema a reference names. */
  const encodedOf = (ref: { readonly file: string; readonly name: string }) => {
    const sf = program.getSourceFile(path.resolve(root, ref.file))
    const value = sf && exportsOf(sf).find((e) => e.name === ref.name)
    const encoded = value && checker.getPropertyOfType(checker.getTypeOfSymbol(resolve(value)), 'Encoded')
    return encoded && checker.getTypeOfSymbol(encoded)
  }
  /** Whether `t` is a string (or `undefined`, an absent value); `arrays`: or an array of strings, as a query value may be. */
  const stringy = (t: ts.Type, arrays: boolean): boolean =>
    !!(t.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.Undefined)) ||
    (t.isUnion() && t.types.every((m) => stringy(m, arrays))) ||
    (arrays && checker.isArrayType(t) && stringy(checker.getTypeArguments(t as ts.TypeReference)[0]!, false))
  /** Whether `t` is an object of `stringy` values (or `undefined`, an absent part). */
  const stringyObject = (t: ts.Type, arrays: boolean): boolean =>
    t.isUnion()
      ? t.types.every((m) => m.flags & ts.TypeFlags.Undefined || stringyObject(m, arrays))
      : !!(t.flags & ts.TypeFlags.Object || t.isIntersection()) &&
        !checker.isArrayType(t) &&
        checker.getPropertiesOfType(t).every((p) => stringy(checker.getTypeOfSymbol(p), arrays)) &&
        checker.getIndexInfosOfType(t).every((i) => stringy(i.type, arrays))

  /**
   * `params` or `query` with string codecs on its printed `number` and `boolean`, as a path or query string decodes to
   * it; throws an `Unreadable` at `at` naming what cannot. A query value may also be an array of them.
   */
  const fromStrings = (part: TypeSchema, key: 'params' | 'query', at: ts.Node): TypeSchema => {
    const arrays = key === 'query'
    const strings = `strings${arrays ? ' or arrays of strings' : ''}`
    const cannot = (where: string, t: TypeSchema): never => {
      const what = t.kind === 'literal' ? `the literal ${JSON.stringify(t.value)}` : `\`${t.kind}\``
      throw new Unreadable(at, `reads ${where} as ${what}; ${key} is an object of ${strings}`)
    }
    const fromRef = (t: TypeSchema & { readonly kind: 'ref' }, where: string, object: boolean) => {
      const encoded = encodedOf(t)
      if (encoded && (object ? stringyObject(encoded, arrays) : stringy(encoded, arrays))) return t
      throw new Unreadable(
        at,
        `reads ${where} from the Schema "${t.name}" of "${t.file}", which does not encode to ${object ? 'an object of ' : ''}${strings}`,
      )
    }
    const value = (t: TypeSchema, where: string, element: boolean): TypeSchema => {
      switch (t.kind) {
        case 'string':
        case 'undefined':
          return t
        case 'number':
        case 'boolean':
          return { kind: t.kind, codec: 'string' }
        case 'literal':
          return typeof t.value === 'string' ? t : cannot(where, t)
        case 'union':
          return { kind: 'union', members: t.members.map((m) => value(m, where, element)) }
        case 'array':
          return arrays && !element ? { ...t, element: value(t.element, `${where}[]`, true) } : cannot(where, t)
        case 'ref':
          return fromRef(t, where, false)
        default:
          return cannot(where, t)
      }
    }
    const object = (t: TypeSchema): TypeSchema => {
      switch (t.kind) {
        case 'object':
          return {
            kind: 'object',
            properties: t.properties.map((p) => ({ ...p, type: value(p.type, `${key}.${p.name}`, false) })),
          }
        case 'record':
          return { ...t, value: value(t.value, `${key}[string]`, false) }
        // `params?:` adds `undefined`.
        case 'union':
          return { kind: 'union', members: t.members.map(object) }
        case 'undefined':
          return t
        case 'ref':
          return fromRef(t, key, true)
        default:
          return cannot(key, t)
      }
    }
    return object(part)
  }

  /** The input check the reader runs on the parameter's type, before any Schema is built. */
  const inputRule =
    (method: ControllerMethodName) =>
    (t: ts.Type): string | undefined => {
      if (t.isUnion() || !(t.flags & ts.TypeFlags.Object || t.isIntersection()))
        return 'takes an input that is not one object `{ params?, query?, body? }`'
      for (const p of checker.getPropertiesOfType(t)) {
        if (!INPUT.includes(p.name))
          return `takes the unknown input key "${p.name}"; the input is \`{ params?, query?, body? }\``
        if (p.name === 'body' && !BODY.has(method))
          return `takes a \`body\`, which ${method} cannot have; only POST, PUT, PATCH and DELETE do`
      }
      return undefined
    }

  /** The written signature of an exported method: a function, or a variable holding or typed as one. */
  const signatureOf = (decl: ts.Declaration | undefined): ts.SignatureDeclaration | undefined => {
    if (decl && ts.isFunctionDeclaration(decl)) return decl
    if (!decl || !ts.isVariableDeclaration(decl)) return undefined
    if (decl.type) return ts.isFunctionTypeNode(decl.type) ? decl.type : undefined
    const init = decl.initializer && unwrap(decl.initializer)
    return init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) ? init : undefined
  }

  const methodOf = (
    route: ControllerRoute,
    name: ControllerMethodName,
    exported: ts.Symbol,
    sf: ts.SourceFile,
  ): ControllerMethod | undefined => {
    const label = `Controller "${route.route}" ${name}`
    const at = exported.declarations?.[0] ?? sf
    const shape = (n: ts.Node, why: string) => void report('ControllerMethodShape', n, `${label} ${why}`)
    const sig = signatureOf(resolve(exported).valueDeclaration)
    if (!sig) return shape(at, `is not written as a function; write \`export const ${name} = (input: { ... }) => ...\``)
    const read = readSignature({ program, checker, root, serverDir }, sig, {
      requires: 'any',
      returns: 'optional',
      errors: 'any',
      input: inputRule(name),
    })
    if (read instanceof Unreadable) return shape(read.at, read.why)
    if (read instanceof NotSerializable)
      return void report(
        'ServerServiceTypeNotSerializable',
        sig,
        `${label}: ${read.path} has type "${read.text}", which is not serializable (${read.why})`,
      )
    const param = sig.parameters[0] ?? sig
    const { input } = read.schema
    if (input.kind === 'ref')
      return shape(param, 'reads its whole input from a Schema reference; reference a Schema for params, query or body')
    if (input.kind !== 'void' && input.kind !== 'object')
      return shape(param, 'takes an input that is not one object `{ params?, query?, body? }`')
    let marked: TypeSchema
    try {
      marked =
        input.kind === 'object'
          ? {
              kind: 'object',
              properties: input.properties.map((p) =>
                p.name === 'params' || p.name === 'query' ? { ...p, type: fromStrings(p.type, p.name, param) } : p,
              ),
            }
          : input
    } catch (e) {
      if (e instanceof Unreadable) return shape(e.at, e.why)
      throw e
    }
    const wanted = route.pattern.split('/').flatMap((s) => /^[:*](\w+)\??$/.exec(s)?.[1] ?? [])
    const params = read.input && checker.getPropertyOfType(read.input, 'params')
    const keys = params
      ? checker.getPropertiesOfType(checker.getNonNullableType(checker.getTypeOfSymbol(params))).map((p) => p.name)
      : []
    const list = (names: readonly string[]) => (names.length ? names.map((n) => `"${n}"`).join(', ') : 'none')
    if (keys.length !== wanted.length || keys.some((k) => !wanted.includes(k)))
      return void report(
        'ControllerParamsMismatch',
        param,
        `${label} declares params ${list(keys)}, but its path ${route.pattern} has ${list(wanted)}`,
      )
    return {
      name,
      location: locationOf(root, at),
      requires: read.requires,
      schema: { input: marked, success: read.schema.success },
    }
  }

  const controllers: ControllerDecl[] = []
  /** A `_defaults.ts` wrap is checked for each Controller beneath it, and reported once per missing service. */
  const reportedWraps = new Set<string>()
  for (const sf of sources.filter((s) => CONTROLLER.test(s.fileName))) {
    let route: ControllerRoute | undefined
    try {
      route = controllerRoute(controllersDir, sf.fileName)
    } catch (e) {
      report('Unresolvable', sf, (e as Error).message)
      continue
    }
    if (!route) continue
    const methods: ControllerMethod[] = []
    for (const exported of exportsOf(sf)) {
      const name = exported.getName()
      // A type export is erased: never served.
      if (!(resolve(exported).flags & ts.SymbolFlags.Value)) continue
      if (isMethod(name)) {
        const method = methodOf(route, name, exported, sf)
        if (method) methods.push(method)
      } else if (name === 'default' || isMethod(name.toUpperCase()))
        report(
          'ControllerMethodShape',
          exported.declarations?.[0] ?? sf,
          `Controller "${route.route}" exports "${name}", which is not served; a method is a named export ${METHODS.join(', ')}`,
        )
    }
    methods.sort((a, b) => METHODS.indexOf(a.name) - METHODS.indexOf(b.name))
    const provided = new Set<ts.Symbol>()
    const isProvided = (tag: ts.Symbol | undefined) =>
      tag && (REQUEST_SERVICES.has(libId(tag, checker) ?? '') || fromApp.has(tag) || provided.has(tag))
    // A wrap's result runs inside the wraps above it only, so only they discharge what it requires.
    for (const wrap of wraps(sf)) {
      for (const t of wrap.requires) {
        const tag = t.getSymbol()
        const name = tag?.getName() ?? checker.typeToString(t)
        const at = locationOf(root, wrap.at)
        if (isProvided(tag) || reportedWraps.has(`${at.file}#${name}`)) continue
        reportedWraps.add(`${at.file}#${name}`)
        errors.push(
          analyzeError(
            'MissingDependency',
            `The wrap of "${at.file}" requires "${name}", which no wrap above it, no Layer File and no start({ layer }) provides`,
            at,
          ),
        )
      }
      for (const tag of wrap.discharged) provided.add(tag)
    }
    for (const method of methods)
      for (const t of membersOf(method.requires)) {
        const tag = t.getSymbol()
        if (isProvided(tag)) continue
        errors.push(
          analyzeError(
            'MissingDependency',
            `Controller "${route.route}" ${method.name} requires "${tag?.getName() ?? checker.typeToString(t)}", which no wrap above it, no Layer File and no start({ layer }) provides`,
            method.location,
          ),
        )
      }
    controllers.push({ ...route, file: path.relative(root, sf.fileName), methods })
  }
  return { controllers, errors, checker }
}
