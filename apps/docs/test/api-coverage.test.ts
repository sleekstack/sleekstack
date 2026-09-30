import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { resolveEntryPoints } from '../scripts/entry-points.mjs'

const apiDir = join(dirname(fileURLToPath(import.meta.url)), '../content/docs/api')

function exportSymbols(file: string) {
  const program = ts.createProgram([file], { module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX, strict: true, skipLibCheck: true, noEmit: true })
  const checker = program.getTypeChecker()
  const moduleSymbol = checker.getSymbolAtLocation(program.getSourceFile(file)!)!
  // `@internal` exports are adapter plumbing, excluded from the reference like TypeDoc's excludeInternal.
  const internal = (s: ts.Symbol) =>
    (s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s).getJsDocTags(checker).some((t) => t.name === 'internal')
  return { checker, symbols: checker.getExportsOfModule(moduleSymbol).filter((s) => !internal(s)) }
}

const exportsOf = (file: string) => exportSymbols(file).symbols.map((s) => s.name)

/** Exports whose TSDoc summary is empty (aliases resolved to their declaration). */
export function undocumented(file: string): string[] {
  const { checker, symbols } = exportSymbols(file)
  return symbols
    .filter((s) => {
      const target = s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s
      // `export * as X` carries its summary on the export declaration; the aliased module has none.
      const nsDoc = (s.declarations ?? []).filter(ts.isNamespaceExport).flatMap((d) => ts.getJSDocCommentsAndTags(d.parent))
      return ts.displayPartsToString(target.getDocumentationComment(checker)).trim() === '' && nsDoc.length === 0
    })
    .map((s) => s.name)
}

describe.each(resolveEntryPoints())('$name', ({ pkg, entry, file }) => {
  const page = join(apiDir, pkg, `${entry}.md`)

  it('has a reference page with an entry for every export', () => {
    expect(existsSync(page), page).toBe(true)
    const text = readFileSync(page, 'utf8')
    const names = exportsOf(file)
    expect(names.length).toBeGreaterThan(0)
    const missing = names.filter((n) => !new RegExp(`^### ${n.replace(/\$/g, '\\$')}(\\(\\))?$`, 'm').test(text))
    expect(missing).toEqual([])
  })

  it('every export has a non-empty summary', () => {
    expect(undocumented(file)).toEqual([])
  })
})

it('next reference documents runEffect', () => {
  const text = readFileSync(join(apiDir, 'next', 'index.md'), 'utf8')
  expect(text).toMatch(/^### runEffect(\(\))?$/m)
  expect(text).not.toMatch(/^### (Operation|action|query)(\(\))?$/m)
})
