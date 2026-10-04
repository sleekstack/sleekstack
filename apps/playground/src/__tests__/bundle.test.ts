/**
 * apps/playground/src/__tests__/bundle.test.ts
 *
 * R11: a client bundle that imports only Tags must not contain server-only
 * service implementations. Builds the playground (two entries: the app, and
 * a Tag-only entry — see vite.config.ts) and asserts SERVER_ONLY_MARKER from
 * ./services.server is absent from the Tag-only entry's output chunk.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { build } from 'vite'
import { SERVER_ONLY_MARKER } from '../services.server'
import { STORES_KEY } from '@sleekstack/react/internal'

type RolldownOutput = Extract<Awaited<ReturnType<typeof build>>, { output: unknown }>

const root =fileURLToPath(new URL('../..', import.meta.url))

describe('playground bundle separation (R11)', () => {
  it('a Tag-only entry build never contains the server-only implementation marker', async () => {
    const outDir = mkdtempSync(path.join(tmpdir(), 'sleekstack-playground-dist-'))
    try {
      const result = (await build({
        root,
        logLevel: 'silent',
        build: { outDir, emptyOutDir: true, write: true },
      })) as RolldownOutput
      const chunks = result.output.filter((o) => o.type === 'chunk')

      const clientChunk = chunks.find((c) => c.name === 'client-tags')
      expect(clientChunk).toBeDefined()

      // Walk the full chunk graph reachable from the client-tags entry (static +
      // dynamic imports), not just its own (near-empty, re-exporting) file: a
      // server implementation could otherwise leak into a shared chunk it imports.
      const byFile = new Map(chunks.map((c) => [c.fileName, c]))
      const reachable = new Set<string>()
      const stack = [clientChunk!.fileName]
      while (stack.length > 0) {
        const fileName = stack.pop()!
        if (reachable.has(fileName)) continue
        reachable.add(fileName)
        const chunk = byFile.get(fileName)
        if (!chunk) continue
        for (const dep of [...chunk.imports, ...chunk.dynamicImports]) stack.push(dep)
      }
      for (const fileName of reachable) {
        const source = readFileSync(path.join(outDir, fileName), 'utf8')
        expect(source, `${fileName} (reachable from the client-tags entry) must not contain SERVER_ONLY_MARKER`).not.toContain(
          SERVER_ONLY_MARKER,
        )
      }

      // Sanity: the marker exists somewhere in the full build, outside that reachable
      // set, so the assertions above aren't vacuous (they'd also pass on an empty graph).
      const markerFoundOutsideClientGraph = chunks.some(
        (c) => !reachable.has(c.fileName) && readFileSync(path.join(outDir, c.fileName), 'utf8').includes(SERVER_ONLY_MARKER),
      )
      expect(markerFoundOutsideClientGraph).toBe(true)
    } finally {
      rmSync(outDir, { recursive: true, force: true })
    }
  }, 30_000)

  it('production client chunks carry no dev atom store registry code', async () => {
    const outDir = mkdtempSync(path.join(tmpdir(), 'sleekstack-playground-dist-'))
    const env = process.env.NODE_ENV
    process.env.NODE_ENV = 'production' // vitest sets 'test', which Vite would otherwise bake into the build
    try {
      const result = (await build({ root, mode: 'production', logLevel: 'silent', build: { outDir, emptyOutDir: true, write: true } })) as RolldownOutput
      const sources = result.output.filter((o) => o.type === 'chunk').map((c) => c.code)
      // Sanity: LayerProvider (whose dev path writes the registry) is in the build.
      expect(sources.some((c) => c.includes('[@sleekstack/react] onFinalizerError threw:'))).toBe(true)
      for (const code of sources) expect(code).not.toContain(STORES_KEY)
    } finally {
      process.env.NODE_ENV = env
      rmSync(outDir, { recursive: true, force: true })
    }
  }, 30_000)
})
