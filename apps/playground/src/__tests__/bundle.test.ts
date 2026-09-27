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
import { build, type RollupOutput } from 'vite'
import { SERVER_ONLY_MARKER } from '../services.server'

const root = fileURLToPath(new URL('../..', import.meta.url))

describe('playground bundle separation (R11)', () => {
  it('a Tag-only entry build never contains the server-only implementation marker', async () => {
    const outDir = mkdtempSync(path.join(tmpdir(), 'sleekstack-playground-dist-'))
    try {
      const result = (await build({
        root,
        logLevel: 'silent',
        build: { outDir, emptyOutDir: true, write: true },
      })) as RollupOutput
      const chunks = result.output.filter((o) => o.type === 'chunk')

      const clientChunk = chunks.find((c) => c.name === 'client-tags')
      expect(clientChunk).toBeDefined()
      const clientSource = readFileSync(path.join(outDir, clientChunk!.fileName), 'utf8')
      expect(clientSource).not.toContain(SERVER_ONLY_MARKER)

      // Sanity: the marker exists somewhere in the build, so the assertion above isn't vacuous.
      const markerFoundSomewhere = chunks.some((c) => readFileSync(path.join(outDir, c.fileName), 'utf8').includes(SERVER_ONLY_MARKER))
      expect(markerFoundSomewhere).toBe(true)
    } finally {
      rmSync(outDir, { recursive: true, force: true })
    }
  }, 30_000)
})
