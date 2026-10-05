/** R6 (ADR 0019): one public name, one meaning across the kit entry points. */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('../..', import.meta.url))
const ENTRIES = ['src/index.ts', 'src/next/index.ts', 'src/react/index.ts']
// Deprecated aliases kept for one release; each must be marked @deprecated at its export.
const DEPRECATED = new Set(['src/next/index.ts#effect'])

describe('kit entry-point export names', () => {
  const program = ts.createProgram(
    ENTRIES.map((e) => path.join(root, e)),
    {
      strict: true,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      skipLibCheck: true,
    },
  )
  const checker = program.getTypeChecker()
  const exported = ENTRIES.flatMap((entry) =>
    checker
      .getExportsOfModule(checker.getSymbolAtLocation(program.getSourceFile(path.join(root, entry))!)!)
      .map((s) => ({ entry, s })),
  )

  it('no name is exported by two entry points with different declarations', () => {
    const meaning = new Map<string, ts.Symbol>()
    const clashes: string[] = []
    for (const { entry, s } of exported) {
      if (DEPRECATED.has(`${entry}#${s.name}`)) continue
      const target = s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s
      const prev = meaning.get(s.name)
      if (prev && prev !== target) clashes.push(`${s.name} (${entry})`)
      meaning.set(s.name, target)
    }
    expect(clashes).toEqual([])
  }, 60_000)

  it('each deprecated alias is marked @deprecated and resolves to its replacement', () => {
    for (const key of DEPRECATED) {
      const [entry, name] = key.split('#') as [string, string]
      const s = exported.find((x) => x.entry === entry && x.s.name === name)!.s
      expect(
        ts.getJSDocTags(s.declarations![0]!.parent.parent).some((t) => t.tagName.text === 'deprecated'),
        key,
      ).toBe(true)
      expect(checker.getAliasedSymbol(s).name).toBe('runOperation')
    }
  }, 60_000)
})
