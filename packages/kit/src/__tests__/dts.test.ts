/**
 * R7: the emitted .d.ts (text) and the exported symbol types (compiler API)
 * never reach `effect` or @sleekstack/core|next|react.
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('../..', import.meta.url))
// Any module reference to effect (or effect/*) or to the wrapped packages. Bare words like the kit `effect()` API are fine.
const FORBIDDEN_TEXT = /['"]effect(\/[^'"]*)?['"]|@sleekstack\/(core|next|react|query)/
const FORBIDDEN_FILE = /\/node_modules\/effect\/|\/packages\/(core|next|react|query)\//

describe('declaration surface (R7)', () => {
  it('emitted .d.ts files never reference effect or core/next/react', () => {
    const out = path.join(root, 'dist-types')
    rmSync(out, { recursive: true, force: true })
    execFileSync('pnpm', ['build:types'], { cwd: root, stdio: 'pipe' })
    const files = (readdirSync(out, { recursive: true }) as string[]).filter((f) => f.endsWith('.d.ts'))
    expect(files.length).toBeGreaterThan(0)
    expect(files).toEqual(expect.arrayContaining(['index.d.ts', 'query.d.ts', path.join('next', 'index.d.ts'), path.join('react', 'index.d.ts')]))
    for (const f of files) expect(readFileSync(path.join(out, f), 'utf8'), f).not.toMatch(FORBIDDEN_TEXT)
  }, 60_000)

  /** Forbidden declaration files reachable from an entry's exports (depth-capped walk). */
  const reach = (entry: string) => {
    const program = ts.createProgram([entry], { strict: true, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, skipLibCheck: true })
    const checker = program.getTypeChecker()
    const hits = new Set<string>()
    const seen = new Set<ts.Type>()
    const decls = (s: ts.Symbol | undefined) =>
      s?.declarations?.forEach((d) => { const f = d.getSourceFile().fileName; if (FORBIDDEN_FILE.test(f)) hits.add(`${s.name} @ ${f}`) })
    const visit = (t: ts.Type, depth: number) => {
      if (depth > 6 || seen.has(t)) return
      seen.add(t)
      decls(t.symbol); decls(t.aliasSymbol)
      t.aliasTypeArguments?.forEach((a) => visit(a, depth + 1))
      if (t.isUnionOrIntersection()) t.types.forEach((u) => visit(u, depth + 1))
      if (t.flags & ts.TypeFlags.Object && (t as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference) {
        checker.getTypeArguments(t as ts.TypeReference).forEach((a) => visit(a, depth + 1))
      }
      for (const p of checker.getPropertiesOfType(t)) {
        decls(p)
        const d = p.valueDeclaration ?? p.declarations?.[0]
        if (d) visit(checker.getTypeOfSymbolAtLocation(p, d), depth + 1)
      }
      for (const sig of [...t.getCallSignatures(), ...t.getConstructSignatures()]) {
        sig.parameters.forEach((p) => { const d = p.valueDeclaration; if (d) visit(checker.getTypeOfSymbolAtLocation(p, d), depth + 1) })
        visit(sig.getReturnType(), depth + 1)
      }
    }
    const sf = program.getSourceFile(entry)!
    const exports = checker.getExportsOfModule(checker.getSymbolAtLocation(sf)!)
    for (let s of exports) {
      if (s.flags & ts.SymbolFlags.Alias) s = checker.getAliasedSymbol(s)
      decls(s)
      const d = s.valueDeclaration ?? s.declarations![0]!
      visit(s.flags & ts.SymbolFlags.Value ? checker.getTypeOfSymbolAtLocation(s, d) : checker.getDeclaredTypeOfSymbol(s), 0)
    }
    return { exports: exports.length, hits: [...hits] }
  }

  it.each(['src/index.ts', 'src/next/index.ts', 'src/react/index.ts'])('%s exports resolve to no effect/core declaration', (entry) => {
    expect(reach(path.join(root, entry)).hits).toEqual([])
  }, 60_000)

  it('the walker flags core (non-vacuous)', () => {
    const r = reach(path.join(root, '../core/src/index.ts'))
    expect(r.exports).toBeGreaterThan(0)
    expect(r.hits.some((h) => h.includes("/node_modules/effect/"))).toBe(true)
    expect(reach(path.join(root, 'src/index.ts')).exports).toBeGreaterThan(5)
  }, 60_000)
})
