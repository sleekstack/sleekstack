import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { afterAll, describe, expect, it } from 'vitest'
import { repoRoot } from '../scripts/entry-points.mjs'

const docsDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const kitSrc = join(repoRoot, 'packages/kit/src')
// Inside apps/docs so `@sleekstack/*` resolves through its node_modules.
const tmp = mkdtempSync(join(docsDir, '.examples-'))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))

/** Every ```ts / ```tsx block inside `@example` TSDoc of kit's sources. */
function kitExamples(): { id: string; lang: string; code: string }[] {
  const files = readdirSync(kitSrc, { recursive: true, encoding: 'utf8' }).filter((f) => /\.tsx?$/.test(f))
  return files.flatMap((f) => {
    const text = readFileSync(join(kitSrc, f), 'utf8')
    return [...text.matchAll(/@example\s*\n\s*\*\s*```(tsx?)\n([\s\S]*?)\n\s*\*\s*```/g)].map((m, i) => ({
      id: `${f}#${i + 1}`,
      lang: m[1]!,
      code: m[2]!.split('\n').map((l) => l.replace(/^\s*\* ?/, '')).join('\n'),
    }))
  })
}

/** Typechecks snippets with apps/docs' compiler options; returns formatted diagnostics. */
function typecheck(snippets: { id: string; lang: string; code: string }[]): string[] {
  const config = ts.getParsedCommandLineOfConfigFile(join(docsDir, 'tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} })!
  const names = snippets.map((s, i) => {
    const file = join(tmp, `${i}.${s.lang}`)
    // `export {}` makes every snippet a module, so top-level names never collide.
    writeFileSync(file, `${s.code}\nexport {}\n`)
    return file
  })
  const { incremental, tsBuildInfoFile, plugins, ...options } = config.options
  const program = ts.createProgram(names, { ...options, noEmit: true })
  return ts.getPreEmitDiagnostics(program)
    .filter((d) => d.file && names.includes(d.file.fileName))
    .map((d) => `${snippets[names.indexOf(d.file!.fileName)]!.id}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`)
}

describe('kit @example blocks', () => {
  it('are found', () => {
    expect(kitExamples().length).toBeGreaterThan(10)
  })

  it('compile', () => {
    expect(typecheck(kitExamples())).toEqual([])
  })

  it('a broken example fails the check', () => {
    const broken = { id: 'broken', lang: 'ts', code: "import { tag } from '@sleekstack/kit'\ntag<number>(42)" }
    expect(typecheck([broken])).toHaveLength(1)
  })
})
