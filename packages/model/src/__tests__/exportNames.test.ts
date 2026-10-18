/** ADR 0019: one public name, one meaning across the model entry points. */
import path from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'

const root = path.join(__dirname, '../..')
const ENTRIES = ['src/index.ts', 'src/query.ts']

it('no name is exported by two model entry points with different declarations', { timeout: 60_000 }, () => {
  const program = ts.createProgram(
    ENTRIES.map((e) => path.join(root, e)),
    {
      strict: true,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      skipLibCheck: true,
    },
  )
  const checker = program.getTypeChecker()
  const meaning = new Map<string, ts.Symbol>()
  const clashes: string[] = []
  for (const entry of ENTRIES)
    for (const s of checker.getExportsOfModule(
      checker.getSymbolAtLocation(program.getSourceFile(path.join(root, entry))!)!,
    )) {
      const target = s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s
      const prev = meaning.get(s.name)
      if (prev && prev !== target) clashes.push(`${s.name} (${entry})`)
      meaning.set(s.name, target)
    }
  expect(meaning.size).toBeGreaterThan(0)
  expect(clashes).toEqual([])
})
