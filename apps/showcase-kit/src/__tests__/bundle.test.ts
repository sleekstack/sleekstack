/**
 * apps/showcase-kit/src/__tests__/bundle.test.ts
 *
 * R9: client chunks from the real `next build` output must not contain the
 * server-only marker; server output must (so the check isn't vacuous).
 * Needs a prior `pnpm --filter showcase-kit build`; skipped when `.next` is missing.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { SERVER_ONLY_MARKER } from '../domain/modules.server'
import { ISLAND_MARKER } from '../islands/marker'

const nextDir = fileURLToPath(new URL('../../.next', import.meta.url))
const built = existsSync(path.join(nextDir, 'static', 'chunks'))
if (!built) console.warn('[bundle.test] .next build output missing: run `pnpm --filter showcase-kit build` first; skipping.')

const jsFiles = (dir: string): string[] =>
  (readdirSync(dir, { recursive: true }) as string[]).filter((f) => f.endsWith('.js')).map((f) => path.join(dir, f))

describe.skipIf(!built)('showcase bundle separation (R10)', () => {
  it('client chunks never contain SERVER_ONLY_MARKER', () => {
    const files = jsFiles(path.join(nextDir, 'static', 'chunks'))
    expect(files.length).toBeGreaterThan(0)
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toContain(SERVER_ONLY_MARKER)
  })

  it('server output does contain it (non-vacuous)', () => {
    const found = jsFiles(path.join(nextDir, 'server')).some((f) => readFileSync(f, 'utf8').includes(SERVER_ONLY_MARKER))
    expect(found).toBe(true)
  })
})

// Only `.next` output is scanned, so stray compiled `.js` / `.d.ts` next to sources can never match.
describe.skipIf(!built)('Island code is deferred (fn-10 R6)', () => {
  const read = (rel: string) => readFileSync(path.join(nextDir, rel), 'utf8')
  const manifest = (f: string) => JSON.parse(read(f))
  // Everything the /islands page loads up front: root main files, polyfills, and its layout + page chunks.
  const entry = (): Set<string> => {
    const build = manifest('build-manifest.json')
    const app = manifest('app-build-manifest.json').pages
    return new Set<string>([...build.rootMainFiles, ...build.polyfillFiles, ...app['/layout'], ...app['/islands/page']])
  }

  it('the Island marker is absent from every entry chunk of /islands', () => {
    const files = [...entry()]
    expect(files.length).toBeGreaterThan(0)
    for (const f of files) expect(read(f), f).not.toContain(ISLAND_MARKER)
  })

  it('and present in a lazily loaded chunk (non-vacuous)', () => {
    const initial = entry()
    const lazy = jsFiles(path.join(nextDir, 'static', 'chunks'))
      .map((f) => path.relative(nextDir, f).split(path.sep).join('/'))
      .filter((f) => !initial.has(f) && read(f).includes(ISLAND_MARKER))
    expect(lazy.length).toBeGreaterThan(0)
  })
})
