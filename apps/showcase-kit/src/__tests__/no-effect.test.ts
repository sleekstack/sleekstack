/**
 * apps/showcase-kit/src/__tests__/no-effect.test.ts
 *
 * The app is kit-only: no source file imports `effect` or the core/next/react packages.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const root = fileURLToPath(new URL('../..', import.meta.url))
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
  )
const FORBIDDEN = /from\s+['"](effect(\/[^'"]*)?|@sleekstack\/(core|next|react)(\/[^'"]*)?)['"]/

it('no app file imports effect or @sleekstack/(core|next|react)', () => {
  const files = [...walk(join(root, 'app')), ...walk(join(root, 'src')), join(root, 'instrumentation.ts')]
  expect(files.length).toBeGreaterThan(1)
  const offenders = files.filter((f) => FORBIDDEN.test(readFileSync(f, 'utf8')))
  expect(offenders).toEqual([])
})
