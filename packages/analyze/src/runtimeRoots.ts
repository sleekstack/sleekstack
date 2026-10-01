/**
 * packages/analyze/src/runtimeRoots.ts
 *
 * `runEffect(effect, { request, overrides })` call sites as extra roots. Each Layer-valued branch of a
 * `request` / `overrides` value is one root, validated over the union of its own provides and any
 * `configureRuntime` app root (it Shadows the app, as in core). Nullish branches are skipped; a call
 * without either option makes no root; options that are not an object literal fail closed.
 */

import ts from 'typescript'
import { graphOf } from './extract'
import { validate } from './validate'
import type { AnalyzeError, Graph, Location, ModuleDecl, ProviderDecl, RootKind } from './model'

export const RUNTIME_RUN_CALLS = new Set(['runtime/runtime#runEffect', 'next/runtime#runEffect'])

export interface ExtraRoot {
  readonly kind: Exclude<RootKind, 'app'>
  readonly module: ModuleDecl
}

/** The extract() internals a root needs. */
export interface RootCtx {
  readonly loc: (n: ts.Node) => Location
  readonly text: (n: ts.Node) => string
  readonly unwrap: (e: ts.Expression) => ts.Expression
  readonly fail: (n: ts.Node, message: string, code?: string) => never
  readonly plainLayer: (e: ts.Expression, out: (p: ProviderDecl) => void) => void
  readonly report: (e: unknown, owner?: ModuleDecl) => void
  /** A located unreadable-declaration error (never a crash). */
  readonly isUnreadable: (e: unknown) => boolean
  /** Downgrade an unresolvable layer to one opaque node instead of an error. */
  readonly lenient: boolean
}

const isNullish = (e: ts.Expression) =>
  e.kind === ts.SyntaxKind.NullKeyword || ts.isVoidExpression(e) || (ts.isIdentifier(e) && e.text === 'undefined')

/** The roots of one `runEffect` call (throws a NonLiteralOptions Unreadable for unreadable options). */
export function runEffectRoots(call: ts.CallExpression, ctx: RootCtx): ExtraRoot[] {
  const opts = call.arguments[1]
  if (!opts) return []
  const o = ctx.unwrap(opts)
  const nonLiteral = (n: ts.Node, what: string) =>
    ctx.fail(n, `runEffect options ${what} "${ctx.text(n)}" cannot be read statically; pass an object literal`, 'NonLiteralOptions')
  if (!ts.isObjectLiteralExpression(o)) return nonLiteral(opts, 'value')
  const values: ['request' | 'overrides', ts.Expression][] = []
  for (const p of o.properties) {
    if (ts.isSpreadAssignment(p)) return nonLiteral(p, 'spread')
    if (p.name && ts.isComputedPropertyName(p.name)) return nonLiteral(p, 'key')
    const name = p.name && ts.isIdentifier(p.name) ? p.name.text : undefined
    if (name !== 'request' && name !== 'overrides') continue
    if (ts.isPropertyAssignment(p)) values.push([name, p.initializer])
    else if (ts.isShorthandPropertyAssignment(p)) values.push([name, p.name])
    else return nonLiteral(p, 'member')
  }
  const at = ctx.loc(call)
  const roots: ExtraRoot[] = []
  const branch = (kind: 'request' | 'overrides', e: ts.Expression): void => {
    const u = ctx.unwrap(e)
    if (ts.isConditionalExpression(u)) return (branch(kind, u.whenTrue), branch(kind, u.whenFalse))
    if (isNullish(u)) return
    const m: ModuleDecl = { name: ctx.text(u), entries: [], imports: [], exports: undefined, lifetime: undefined, loc: at }
    try {
      // Located at the call: that is where the layer meets the app graph.
      ctx.plainLayer(u, (p) => m.entries.push({ ...p, loc: at, lifetime: kind === 'request' ? 'request' : p.lifetime }))
      roots.push({ kind, module: m })
    } catch (err) {
      if (!ctx.lenient || !ctx.isUnreadable(err)) {
        roots.push({ kind, module: m })
        return ctx.report(err, m)
      }
      m.entries.length = 0
      m.entries.push({ provides: [], requires: [], lifetime: undefined, opaque: true, loc: ctx.loc(u) })
      roots.push({ kind: 'opaque', module: { ...m, loc: ctx.loc(u) } })
    }
  }
  for (const [kind, v] of values) branch(kind, v)
  return roots
}

const key = (e: AnalyzeError) => `${e.code}|${e.file}:${e.line}|${e.message}`

/**
 * A root passes when its own provides plus ANY app root satisfy it: the first app it validates cleanly
 * over is its graph; otherwise the first app's errors stand. With no app root it stands alone.
 */
export function checkRoot(m: ModuleDecl, apps: readonly ModuleDecl[]): { readonly graph: Graph; readonly errors: AnalyzeError[] } {
  if (!apps.length) return { graph: graphOf(m), errors: validate(m) }
  let first: { graph: Graph; errors: AnalyzeError[] } | undefined
  for (const app of apps) {
    const overlay: ModuleDecl = { ...m, imports: [app] }
    const base = new Set(validate(app).map(key))
    const errors = validate(overlay).filter((e) => !base.has(key(e)))
    const r = { graph: graphOf(overlay), errors }
    if (!errors.length) return r
    first ??= r
  }
  return first!
}
