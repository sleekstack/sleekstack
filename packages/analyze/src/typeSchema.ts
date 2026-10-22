/**
 * packages/analyze/src/typeSchema.ts
 *
 * Type to Schema (ADR 0051): a method's input, success and error types as a closed, JSON-serializable description the
 * generator prints as Schema code. A type outside the subset is a `NotSerializable` naming the property path to it,
 * never a guess. A written `Schema.Schema.Type<typeof X>` is a reference to `X` itself (ADR 0053), read from the
 * signature's own text, because its type no longer names `X`; a reference the reader cannot use is `Unreadable`.
 */

import * as path from 'node:path'
import ts from 'typescript'
import { libId } from './extract'

const TAGGED_ERROR = 'effect/Data#TaggedError'
const SCHEMA_TAGGED_ERROR = 'effect/Schema#TaggedError'
const SCHEMA_TYPE = 'effect/Schema#Type'
const EFFECT = 'effect/Effect#Effect'
/** Router control flow: carried by the wire's own envelope, not by the error Schema. */
const CONTROL = new Set(['router/resolve#Redirect', 'router/resolve#NotFound'])

export interface PropertySchema {
  readonly name: string
  readonly optional: boolean
  readonly type: TypeSchema
}

export interface TaggedErrorSchema {
  readonly kind: 'taggedError'
  /** The class name. */
  readonly name: string
  /** The file declaring the class, relative to the tsconfig directory. */
  readonly file: string
  readonly fields: readonly PropertySchema[]
  /** A `Schema.TaggedError` class is its own Schema: `fields` is empty and the class is used as is. */
  readonly schema?: true
}

export type TypeSchema =
  | { readonly kind: 'string' | 'null' | 'undefined' | 'void' }
  /** `codec: 'string'`: an HTTP path or query value, read from its text (a finite decimal; `true` or `false`). */
  | { readonly kind: 'number' | 'boolean'; readonly codec?: 'string' }
  | { readonly kind: 'literal'; readonly value: string | number | boolean }
  | { readonly kind: 'union'; readonly members: readonly TypeSchema[] }
  | { readonly kind: 'array'; readonly readonly: boolean; readonly element: TypeSchema }
  /** A single `string` index signature and no properties: `Record<string, T>`. */
  | { readonly kind: 'record'; readonly readonly: boolean; readonly value: TypeSchema }
  | { readonly kind: 'object'; readonly properties: readonly PropertySchema[] }
  /** `Schema.Schema.Type<typeof X>`: the Schema `X`, exported as `name` by `file` (relative to the tsconfig directory). */
  | { readonly kind: 'ref'; readonly file: string; readonly name: string }

export interface MethodSchema {
  /** `void` for a method without a parameter. */
  readonly input: TypeSchema
  readonly success: TypeSchema
  /** The tagged errors of `E`; `Redirect` and `NotFound` are left to the wire. */
  readonly error: readonly TaggedErrorSchema[]
}

export class NotSerializable {
  constructor(
    /** The member path to the offender, e.g. `input.tags[]`. */
    readonly path: string,
    readonly text: string,
    readonly why: string,
  ) {}
}

/** A signature or written type the reader cannot use; `why` completes a sentence about the method. */
export class Unreadable {
  constructor(
    readonly at: ts.Node,
    readonly why: string,
  ) {}
}

/**
 * The tagged error base of `class X extends Data.TaggedError('X')<Fields> {}` (its fields as a type node) or of
 * `class X extends Schema.TaggedError<X>()('X', fields) {}` (the class is its own Schema).
 */
export const taggedErrorBase = (
  c: ts.ClassLikeDeclaration,
  checker: ts.TypeChecker,
): { readonly schema: false; readonly fields: ts.TypeNode | undefined } | { readonly schema: true } | undefined => {
  const ext = c.heritageClauses?.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword)?.types[0]
  if (!ext || !ts.isCallExpression(ext.expression)) return undefined
  const callee = ext.expression.expression
  if (libId(checker.getSymbolAtLocation(callee), checker) === TAGGED_ERROR)
    return { schema: false, fields: ext.typeArguments?.[0] }
  if (
    ts.isCallExpression(callee) &&
    libId(checker.getSymbolAtLocation(callee.expression), checker) === SCHEMA_TAGGED_ERROR
  )
    return { schema: true }
  return undefined
}

/**
 * The method's types as a `MethodSchema`. `written` holds the signature's parameter and return type nodes, the text a
 * Schema reference is read from: inline, through a type alias of the signature's file, as a property, an array element
 * or a union member. A referenced `X` must be an exported value of a module that is not `serverOnly`.
 */
export const methodSchema = (
  ctx: {
    readonly program: ts.Program
    readonly checker: ts.TypeChecker
    readonly root: string
    readonly serverOnly: (file: string) => boolean
  },
  m: {
    readonly input: ts.Type | undefined
    readonly success: ts.Type
    readonly error: ts.Type
    readonly written: { readonly input: ts.TypeNode | undefined; readonly returns: ts.TypeNode }
  },
): MethodSchema | NotSerializable | Unreadable => {
  const { program, checker } = ctx
  const F = ts.TypeFlags
  /** Object types on the current path: meeting one again is a recursive type. */
  const stack = new Set<ts.Type>()
  const bad = (at: string, t: ts.Type, why: string): never => {
    throw new NotSerializable(at, checker.typeToString(t), why)
  }
  const home = m.written.returns.getSourceFile()
  const unfollowable = (n: ts.Node): never => {
    throw new Unreadable(
      n,
      'has a Schema reference where the reader cannot follow it; write it inline or through a type alias of this file without type parameters, as a property, an array element or a union member',
    )
  }

  /** The type alias `n` names, when declared in the signature's file. */
  const aliasOf = (n: ts.Node) => {
    const decl = ts.isTypeReferenceNode(n)
      ? checker.getSymbolAtLocation(n.typeName)?.declarations?.find(ts.isTypeAliasDeclaration)
      : undefined
    return decl?.getSourceFile() === home ? decl : undefined
  }
  /** `n` without parentheses and the type aliases of the signature's file that take no type parameters. */
  const unalias = (n: ts.TypeNode, seen = new Set<ts.Node>()): ts.TypeNode => {
    if (ts.isParenthesizedTypeNode(n)) return unalias(n.type, seen)
    const alias = aliasOf(n)
    if (!alias || alias.typeParameters || seen.has(alias)) return n
    seen.add(alias)
    return unalias(alias.type, seen)
  }
  /** The `Schema` namespace of effect's Schema module, when `n` is its `Schema.Schema.Type<...>`. */
  const schemaNamespaceOf = (n: ts.Node): ts.ModuleDeclaration | undefined => {
    const sym = ts.isTypeReferenceNode(n) ? checker.getSymbolAtLocation(n.typeName) : undefined
    const decl = (sym && sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym)?.declarations?.[0]
    return libId(sym, checker) === SCHEMA_TYPE &&
      decl &&
      ts.isModuleBlock(decl.parent) &&
      decl.parent.parent.name.text === 'Schema'
      ? decl.parent.parent
      : undefined
  }
  const isReference = (n: ts.Node): n is ts.TypeReferenceNode => !!schemaNamespaceOf(n)
  /** The references written in `n`, through every type alias of the signature's file (generic ones included). */
  const referencesIn = (n: ts.Node, found = new Set<ts.TypeReferenceNode>(), seen = new Set<ts.Node>()) => {
    if (isReference(n)) return found.add(n)
    const alias = aliasOf(n)
    if (alias && !seen.has(alias)) referencesIn(alias.type, found, seen.add(alias))
    ts.forEachChild(n, (c) => void referencesIn(c, found, seen))
    return found
  }
  /** The name `sf` exports `target` under at run time; an `export type` is erased, so it does not count. */
  const exportName = (sf: ts.SourceFile, target: ts.Symbol) => {
    const own = (s: ts.Symbol) =>
      checker.getExportSymbolOfSymbol(s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s)
    const module = checker.getSymbolAtLocation(sf)
    return module
      ? checker.getExportsOfModule(module).find((e) => {
          const d = e.declarations?.[0]
          return (
            !(d && ts.isExportSpecifier(d) && (d.isTypeOnly || d.parent.parent.isTypeOnly)) && own(e) === own(target)
          )
        })?.name
      : undefined
  }
  const referenceOf = (n: ts.TypeReferenceNode, at: string): TypeSchema => {
    const cannot = (why: string): never => {
      throw new Unreadable(n, `reads ${at} from a Schema reference ${why}`)
    }
    const [query, ...rest] = n.typeArguments ?? []
    if (!query || rest.length || !ts.isTypeQueryNode(query) || !ts.isIdentifier(query.exprName))
      return cannot('that is not `Schema.Schema.Type<typeof X>` with `X` a name')
    const name = query.exprName.text
    const local = checker.getSymbolAtLocation(query.exprName)
    const target = local && (local.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(local) : local)
    const decl = target?.valueDeclaration
    if (!target || !decl) return cannot(`to "${name}", which has no value`)
    const sf = decl.getSourceFile()
    const file = path.relative(ctx.root, sf.fileName)
    if (sf.isDeclarationFile || ts.getCombinedModifierFlags(decl) & ts.ModifierFlags.Ambient)
      return cannot(`to "${name}", which is only declared and has no value at run time`)
    if (ctx.serverOnly(sf.fileName))
      return cannot(`to "${name}" of the server-only "${file}"; reference a Schema of a client-safe module`)
    const exported = exportName(sf, target)
    if (!exported) return cannot(`to "${name}", which "${file}" does not export as a value`)
    // `Schema.Schema.All`: a Schema of any type, `never` included (invariance keeps `never` out of `Any`).
    const all = checker
      .getSymbolAtLocation(schemaNamespaceOf(n)!.name)
      ?.exports?.get(ts.escapeLeadingUnderscores('All'))
    if (!all || !checker.isTypeAssignableTo(checker.getTypeOfSymbol(target), checker.getDeclaredTypeOfSymbol(all)))
      return cannot(`to "${name}", which is not a Schema`)
    return { kind: 'ref', file, name: exported }
  }

  const hasUndefined = (t: TypeSchema): boolean =>
    t.kind === 'undefined' || (t.kind === 'union' && t.members.some(hasUndefined))

  /**
   * `node`, when given, is the written text of `type`; it matters only when it holds a Schema reference. Then each
   * reference is followed where it is written: a union member, an array element, or a property of an object literal.
   * Any other form holding one is `Unreadable`, so a reference never silently becomes its structural type.
   */
  const convert = (type: ts.Type, at: string, node?: ts.TypeNode): TypeSchema => {
    const n = node && unalias(node)
    if (n && isReference(n)) return referenceOf(n, at)
    const written = n && referencesIn(n).size ? n : undefined
    // Member by member: the union type may have merged or reordered the written members.
    if (written && ts.isUnionTypeNode(written))
      return { kind: 'union', members: written.types.map((m) => convert(checker.getTypeFromTypeNode(m), at, m)) }
    if (written && !(elementOf(written) || ts.isTypeLiteralNode(written))) return unfollowable(written)
    const t = written ? checker.getTypeFromTypeNode(written) : type
    if (t.flags & F.Any) return bad(at, t, '`any` has no Schema')
    if (t.flags & F.Unknown) return bad(at, t, '`unknown` has no Schema')
    if (t.flags & F.String) return { kind: 'string' }
    if (t.flags & F.Number) return { kind: 'number' }
    if (t.flags & F.Boolean) return { kind: 'boolean' }
    if (t.flags & F.Null) return { kind: 'null' }
    if (t.flags & F.Undefined) return { kind: 'undefined' }
    if (t.flags & F.Void) return { kind: 'void' }
    if (t.isStringLiteral() || t.isNumberLiteral()) return { kind: 'literal', value: t.value }
    if (t.flags & F.BooleanLiteral) return { kind: 'literal', value: checker.typeToString(t) === 'true' }
    if (t.isUnion()) {
      // `boolean` inside a wider union arrives as `false | true`.
      const bools = t.types.filter((u) => u.flags & F.BooleanLiteral)
      const members = t.types.flatMap((u): TypeSchema[] =>
        bools.length === 2 && u.flags & F.BooleanLiteral
          ? u === bools[0]
            ? [{ kind: 'boolean' }]
            : []
          : [convert(u, at)],
      )
      return { kind: 'union', members }
    }
    if (t.isIntersection() || t.flags & F.Object) return objectOf(t, at, written)
    return bad(at, t, 'it is outside the Server Service type subset')
  }

  /** The element of a written array type: `T[]`, `readonly T[]`, `Array<T>` or `ReadonlyArray<T>`. */
  const elementOf = (n: ts.TypeNode | undefined): ts.TypeNode | undefined => {
    const array = n && ts.isTypeOperatorNode(n) && n.operator === ts.SyntaxKind.ReadonlyKeyword ? n.type : n
    if (array && ts.isArrayTypeNode(array)) return array.elementType
    return array && ts.isTypeReferenceNode(array) && /^(Readonly)?Array$/.test(array.typeName.getText())
      ? array.typeArguments?.[0]
      : undefined
  }

  const objectOf = (t: ts.Type, at: string, n: ts.TypeNode | undefined): TypeSchema => {
    if (stack.has(t)) return bad(at, t, 'a recursive type has no finite Schema')
    stack.add(t)
    try {
      if (t.isIntersection()) {
        for (const member of t.types)
          if (convert(member, at).kind !== 'object') bad(at, t, 'an intersection with a non-object')
      } else {
        if (checker.isTupleType(t)) return bad(at, t, 'tuples are outside the Server Service type subset')
        if (checker.isArrayType(t)) {
          const element = convert(checker.getTypeArguments(t as ts.TypeReference)[0]!, `${at}[]`, elementOf(n))
          // JSON writes an `undefined` element as `null`, which does not decode back.
          if (hasUndefined(element))
            return bad(at, t, 'an array element that may be `undefined` becomes `null` in JSON')
          return { kind: 'array', readonly: t.getSymbol()?.getName() === 'ReadonlyArray', element }
        }
        if (t.getCallSignatures().length || t.getConstructSignatures().length) return bad(at, t, 'a function')
        const sym = t.getSymbol()
        const builtIn = () => bad(at, t, 'a class instance or built-in object')
        if (sym && sym.flags & ts.SymbolFlags.Class) return builtIn()
        // Before the built-in check: `Record<string, T>` is a mapped type declared in the default library.
        const indexes = checker.getIndexInfosOfType(t)
        if (indexes.length) return n ? unfollowable(n) : recordOf(t, indexes, at)
        if (sym?.declarations?.some((d) => program.isSourceFileDefaultLibrary(d.getSourceFile()))) return builtIn()
      }
      return { kind: 'object', properties: propertiesOf(t, at) }
    } finally {
      stack.delete(t)
    }
  }

  const recordOf = (t: ts.Type, indexes: readonly ts.IndexInfo[], at: string): TypeSchema => {
    const [index] = indexes
    if (indexes.length > 1 || !(index!.keyType.flags & F.String))
      return bad(at, t, 'an index signature other than a single `string` key')
    if (checker.getPropertiesOfType(t).length) return bad(at, t, 'properties beside an index signature')
    return { kind: 'record', readonly: index!.isReadonly, value: convert(index!.type, `${at}[string]`) }
  }

  /** A property declared in the signature's file is read with its written type; a mapped or instantiated one's is not its own. */
  const propertiesOf = (t: ts.Type, at: string): PropertySchema[] =>
    checker.getPropertiesOfType(t).map((p) => {
      const decl = p.valueDeclaration ?? p.declarations?.[0]
      const node =
        decl && (ts.isPropertySignature(decl) || ts.isPropertyDeclaration(decl)) && decl.getSourceFile() === home
          ? decl.type
          : undefined
      const derived = !!(p.flags & ts.SymbolFlags.Transient)
      if (node && derived && referencesIn(node).size) unfollowable(node)
      return {
        name: p.getName(),
        optional: !!(p.flags & ts.SymbolFlags.Optional),
        type: convert(checker.getTypeOfSymbol(p), `${at}.${p.getName()}`, derived ? undefined : node),
      }
    })

  const errorOf = (t: ts.Type): TaggedErrorSchema[] => {
    if (t.flags & F.Never) return []
    if (t.isUnion()) return t.types.flatMap(errorOf)
    const sym = t.getSymbol()
    if (CONTROL.has(libId(sym, checker) ?? '')) return []
    const decl = sym?.valueDeclaration
    const base = decl && ts.isClassLike(decl) ? taggedErrorBase(decl, checker) : undefined
    if (!sym || !decl || !base)
      return bad('error', t, 'an error must be a Data.TaggedError or Schema.TaggedError class')
    const error = {
      kind: 'taggedError',
      name: sym.getName(),
      file: path.relative(ctx.root, decl.getSourceFile().fileName),
    } as const
    if (base.schema) return [{ ...error, fields: [], schema: true }]
    const at = `error(${sym.getName()})`
    const fields = base.fields ? convert(checker.getTypeFromTypeNode(base.fields), at) : undefined
    if (fields && fields.kind !== 'object') return bad(at, t, 'tagged error fields must be an object type')
    return [{ ...error, fields: fields?.properties ?? [] }]
  }

  const returns = unalias(m.written.returns)
  const effect =
    ts.isTypeReferenceNode(returns) && libId(checker.getSymbolAtLocation(returns.typeName), checker) === EFFECT
      ? returns
      : undefined
  try {
    // Only `A` of a written `Effect.Effect<A, E, R>` may hold a reference.
    for (const n of effect ? (effect.typeArguments?.slice(1) ?? []) : [m.written.returns])
      if (referencesIn(n).size) unfollowable(n)
    return {
      input: m.input ? convert(m.input, 'input', m.written.input) : { kind: 'void' },
      success: convert(m.success, 'success', effect?.typeArguments?.[0]),
      error: errorOf(m.error),
    }
  } catch (e) {
    if (e instanceof NotSerializable || e instanceof Unreadable) return e
    throw e
  }
}
