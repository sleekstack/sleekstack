import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { expect, it } from 'vitest'

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
