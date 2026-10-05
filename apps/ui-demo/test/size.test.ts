import * as path from 'node:path'
import { gzipSync } from 'node:zlib'
import { build } from 'vite'
import { expect, it } from 'vitest'

it('the resume entry bundles without React; prints its gzipped size', { timeout: 60_000 }, async () => {
  const out = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: true,
      lib: { entry: path.join(__dirname, '../src/resume/entry.ts'), formats: ['es'] },
    },
  })
  const chunks = (Array.isArray(out) ? out : [out])
    .flatMap((o) => ('output' in o ? o.output : []))
    .filter((c) => c.type === 'chunk')
  const entry = chunks.find((c) => c.isEntry)!
  const code = chunks.map((c) => c.code).join('\n')
  expect(code).not.toMatch(/react/i)
  // What loads before the first click: the entry plus its static imports (the handler chunk is lazy).
  const eager = [entry, ...entry.imports.map((f) => chunks.find((c) => c.fileName === f)!)]
    .map((c) => c.code)
    .join('\n')
  const handler = chunks
    .filter((c) => !c.isEntry && !entry.imports.includes(c.fileName))
    .map((c) => c.code)
    .join('\n')
  const min = Buffer.byteLength(eager)
  const gz = gzipSync(eager).length
  console.log(
    `resume entry: ${min} B min, ${gz} B gzip; lazy handler chunk: ${Buffer.byteLength(handler)} B min, ${gzipSync(handler).length} B gzip`,
  )
  expect(gz).toBeGreaterThan(0)
})
