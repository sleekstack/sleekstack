/**
 * apps/showcase/src/__tests__/bundle.test.ts
 *
 * R10: client chunks from the real `next build` output must not contain the
 * server-only marker; server output must (so the check isn't vacuous).
 * Needs a prior `pnpm --filter showcase build`; skipped when `.next` is missing.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DEVTOOLS_MARKER } from '@sleekstack/devtools'
import { SERVER_ONLY_MARKER } from '../domain/live.server'

const nextDir = fileURLToPath(new URL('../../.next', import.meta.url))
const built = existsSync(path.join(nextDir, 'static', 'chunks'))
if (!built) console.warn('[bundle.test] .next build output missing: run `pnpm --filter showcase build` first; skipping.')

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

  it('client chunks never contain the devtools panel (dev-only)', () => {
    if (process.env.NODE_ENV === 'development') return
    for (const f of jsFiles(path.join(nextDir, 'static', 'chunks'))) expect(readFileSync(f, 'utf8'), f).not.toContain(DEVTOOLS_MARKER)
  })
})
