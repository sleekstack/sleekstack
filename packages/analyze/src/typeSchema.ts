/**
 * packages/analyze/src/typeSchema.ts
 *
 * Type to Schema (ADR 0051): a Server Service method's input, success and error types as a closed, JSON-serializable
 * description the generator prints as Schema code. A type outside the subset is a `NotSerializable` naming the property
 * path to it, never a guess.
 */

import * as path from 'node:path'
import ts from 'typescript'
import { libId } from './extract'

const TAGGED_ERROR = 'effect/Data#TaggedError'
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
}

export type TypeSchema =
  | { readonly kind: 'string' | 'number' | 'boolean' | 'null' | 'undefined' | 'void' }
  | { readonly kind: 'literal'; readonly value: string | number | boolean }
  | { readonly kind: 'union'; readonly members: readonly TypeSchema[] }
  | { readonly kind: 'array'; readonly readonly: boolean; readonly element: TypeSchema }
  | { readonly kind: 'object'; readonly properties: readonly PropertySchema[] }

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

/** The `Data.TaggedError('X')<Fields>` base of `class X extends Data.TaggedError('X')<Fields> {}`. */
export const taggedErrorBase = (c: ts.ClassLikeDeclaration, checker: ts.TypeChecker) => {
  const ext = c.heritageClauses?.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword)?.types[0]
  return ext &&
    ts.isCallExpression(ext.expression) &&
    libId(checker.getSymbolAtLocation(ext.expression.expression), checker) === TAGGED_ERROR
    ? ext
    : undefined
}

export const methodSchema = (
  ctx: { readonly program: ts.Program; readonly checker: ts.TypeChecker; readonly root: string },
  m: { readonly input: ts.Type | undefined; readonly success: ts.Type; readonly error: ts.Type },
): MethodSchema | NotSerializable => {
  const { program, checker } = ctx
  const F = ts.TypeFlags
  /** Object types on the current path: meeting one again is a recursive type. */
  const stack = new Set<ts.Type>()
  const bad = (at: string, t: ts.Type, why: string): never => {
    throw new NotSerializable(at, checker.typeToString(t), why)
  }

  const convert = (t: ts.Type, at: string): TypeSchema => {
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
    if (t.isIntersection() || t.flags & F.Object) return objectOf(t, at)
    return bad(at, t, 'it is outside the Server Service type subset')
  }

  const objectOf = (t: ts.Type, at: string): TypeSchema => {
    if (stack.has(t)) return bad(at, t, 'a recursive type has no finite Schema')
    stack.add(t)
    try {
      if (t.isIntersection()) {
        for (const member of t.types)
          if (convert(member, at).kind !== 'object') bad(at, t, 'an intersection with a non-object')
      } else {
        if (checker.isTupleType(t)) return bad(at, t, 'tuples are outside the Server Service type subset')
        if (checker.isArrayType(t)) {
          const element = convert(checker.getTypeArguments(t as ts.TypeReference)[0]!, `${at}[]`)
          return { kind: 'array', readonly: t.getSymbol()?.getName() === 'ReadonlyArray', element }
        }
        if (t.getCallSignatures().length || t.getConstructSignatures().length) return bad(at, t, 'a function')
        const sym = t.getSymbol()
        if (
          sym &&
          (sym.flags & ts.SymbolFlags.Class ||
            sym.declarations?.some((d) => program.isSourceFileDefaultLibrary(d.getSourceFile())))
        )
          return bad(at, t, 'a class instance or built-in object')
      }
      if (checker.getIndexInfosOfType(t).length) return bad(at, t, 'an index signature')
      return { kind: 'object', properties: propertiesOf(t, at) }
    } finally {
      stack.delete(t)
    }
  }

  const propertiesOf = (t: ts.Type, at: string): PropertySchema[] =>
    checker.getPropertiesOfType(t).map((p) => ({
      name: p.getName(),
      optional: !!(p.flags & ts.SymbolFlags.Optional),
      type: convert(checker.getTypeOfSymbol(p), `${at}.${p.getName()}`),
    }))

  const errorOf = (t: ts.Type): TaggedErrorSchema[] => {
    if (t.flags & F.Never) return []
    if (t.isUnion()) return t.types.flatMap(errorOf)
    const sym = t.getSymbol()
    if (CONTROL.has(libId(sym, checker) ?? '')) return []
    const decl = sym?.valueDeclaration
    const base = decl && ts.isClassLike(decl) ? taggedErrorBase(decl, checker) : undefined
    if (!sym || !decl || !base) return bad('error', t, 'an error must be a Data.TaggedError class')
    const at = `error(${sym.getName()})`
    const fieldsNode = base.typeArguments?.[0]
    const fields = fieldsNode ? convert(checker.getTypeFromTypeNode(fieldsNode), at) : undefined
    if (fields && fields.kind !== 'object') return bad(at, t, 'tagged error fields must be an object type')
    return [
      {
        kind: 'taggedError',
        name: sym.getName(),
        file: path.relative(ctx.root, decl.getSourceFile().fileName),
        fields: fields?.properties ?? [],
      },
    ]
  }

  try {
    return {
      input: m.input ? convert(m.input, 'input') : { kind: 'void' },
      success: convert(m.success, 'success'),
      error: errorOf(m.error),
    }
  } catch (e) {
    if (e instanceof NotSerializable) return e
    throw e
  }
}
