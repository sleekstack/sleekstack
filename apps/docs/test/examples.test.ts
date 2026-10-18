import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { afterAll, describe, expect, it } from 'vitest'
import { repoRoot } from '../scripts/entry-points.mjs'

const docsDir = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Typechecks the guide snippets in place (they import each other), with apps/docs' compiler options. */
function snippetDiagnostics(): { count: number; errors: string[] } {
  const dir = join(docsDir, 'snippets')
  const files = readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => join(dir, f))
  const config = ts.getParsedCommandLineOfConfigFile(
    join(docsDir, 'tsconfig.json'),
    {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
  )!
  const { incremental, tsBuildInfoFile, plugins, ...options } = config.options
  const program = ts.createProgram(files, { ...options, noEmit: true })
  const errors = ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.file && d.file.fileName.startsWith(dir))
    .map((d) => `${d.file!.fileName.slice(dir.length + 1)}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`)
  return { count: files.length, errors }
}

it('guide snippets compile', () => {
  const { count, errors } = snippetDiagnostics()
  expect(count).toBeGreaterThan(3)
  expect(errors).toEqual([])
})

// Inside apps/docs so `@sleekstack/*` resolves through its node_modules.
const tmp = mkdtempSync(join(docsDir, '.examples-'))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))

type Example = { id: string; lang: string; code: string }

/** Every ```ts / ```tsx block inside `@example` TSDoc of ui's and start's sources. */
function sourceExamples(): Example[] {
  return ['ui', 'start'].flatMap((pkg) => {
    const src = join(repoRoot, 'packages', pkg, 'src')
    return readdirSync(src, { recursive: true, encoding: 'utf8' })
      .filter((f) => /\.tsx?$/.test(f) && !f.includes('__tests__'))
      .flatMap((f) =>
        [
          ...readFileSync(join(src, f), 'utf8').matchAll(/@example\s*\n\s*\*\s*```(tsx?)\n([\s\S]*?)\n\s*\*\s*```/g),
        ].map((m, i) => ({
          id: `${pkg}/${f}#${i + 1}`,
          lang: m[1]!,
          code: m[2]!
            .split('\n')
            .map((l) => l.replace(/^\s*\* ?/, ''))
            .join('\n'),
        })),
      )
  })
}

/** Typechecks examples with apps/docs' compiler options; JSX examples are typed as ui's. */
function typecheck(examples: Example[]): string[] {
  const config = ts.getParsedCommandLineOfConfigFile(
    join(docsDir, 'tsconfig.json'),
    {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
  )!
  const names = examples.map((e, i) => {
    const file = join(tmp, `${i}.${e.lang}`)
    // `export {}` makes every example a module, so top-level names never collide.
    writeFileSync(file, `${e.lang === 'tsx' ? '/** @jsxImportSource @sleekstack/ui */\n' : ''}${e.code}\nexport {}\n`)
    return file
  })
  const { incremental, tsBuildInfoFile, plugins, ...options } = config.options
  const program = ts.createProgram(names, { ...options, noEmit: true })
  return ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.file && names.includes(d.file.fileName))
    .map(
      (d) =>
        `${examples[names.indexOf(d.file!.fileName)]!.id}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`,
    )
}

describe('ui and start @example blocks', () => {
  it('are found', () => {
    expect(sourceExamples().length).toBeGreaterThanOrEqual(2)
  })

  it('compile', () => {
    expect(typecheck(sourceExamples())).toEqual([])
  })

  it('a broken example fails the check', () => {
    const broken = { id: 'broken', lang: 'ts', code: "import { serverFn } from '@sleekstack/start'\nserverFn(42)" }
    expect(typecheck([broken])).toHaveLength(1)
  })
})
