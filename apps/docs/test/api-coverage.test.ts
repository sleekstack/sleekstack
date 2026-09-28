import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { resolveEntryPoints } from '../scripts/entry-points.mjs'

const apiDir = join(dirname(fileURLToPath(import.meta.url)), '../content/docs/api')

function exportsOf(file: string): string[] {
  const program = ts.createProgram([file], { module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX, strict: true, skipLibCheck: true, noEmit: true })
  const checker = program.getTypeChecker()
  const moduleSymbol = checker.getSymbolAtLocation(program.getSourceFile(file)!)!
  return checker.getExportsOfModule(moduleSymbol).map((s) => s.name)
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

  // Enabled by fn-6.2 once every export carries a TSDoc summary.
  it.skip('every export has a non-empty summary', () => {})
})
