// Shared by generate-api.mjs and test/api-coverage.test.ts: the one list of public entry points.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
export const PACKAGES = ['core', 'next', 'react', 'kit']

/** @returns {{ pkg: string, name: string, entry: string, file: string, route: string }[]} */
export function resolveEntryPoints() {
  return PACKAGES.flatMap((pkg) => {
    const dir = join(repoRoot, 'packages', pkg)
    const json = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    const subpaths = json.exports
      ? Object.entries(json.exports).map(([key, v]) => [key, typeof v === 'string' ? v : v.types ?? v.default])
      : [['.', json.types]]
    return subpaths.map(([key, rel]) => {
      if (!rel) throw new Error(`${json.name}: no types for export "${key}"`)
      const file = join(dir, rel)
      if (!existsSync(file)) throw new Error(`${json.name}: entry point "${key}" resolves to missing file ${file}`)
      const entry = key === '.' ? 'index' : key.replace(/^\.\//, '')
      return { pkg, name: key === '.' ? json.name : `${json.name}/${entry}`, entry, file, route: entry === "index" ? `/docs/api/${pkg}` : `/docs/api/${pkg}/${entry}` }
    })
  })
}
