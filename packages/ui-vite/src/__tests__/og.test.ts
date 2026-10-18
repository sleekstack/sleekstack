// @vitest-environment node
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'vite'
import { afterAll, describe, expect, it } from 'vitest'
import { ogMeta } from '../og-meta.js'

const tmp: string[] = []
const copy = () => {
  const dir = join(import.meta.dirname, `.tmp-${Math.random().toString(36).slice(2)}`)
  cpSync(join(import.meta.dirname, 'fixture'), dir, { recursive: true })
  tmp.push(dir)
  return dir
}
const edit = (dir: string, file: string, from: string | RegExp, to: string) => {
  const f = join(dir, file)
  const before = readFileSync(f, 'utf8')
  const after = before.replace(from, to)
  if (after === before) throw new Error(`${file}: nothing to replace`)
  writeFileSync(f, after)
}
const run = (root: string) => build({ root, configFile: join(root, 'vite.config.ts') })
const size = (file: string) => {
  const png = readFileSync(file)
  return { signature: png.subarray(1, 4).toString(), width: png.readUInt32BE(16), height: png.readUInt32BE(20) }
}

afterAll(() => {
  for (const d of tmp) rmSync(d, { recursive: true, force: true })
})

describe('og images', () => {
  it('writes a 1200 by 630 PNG per route and each page references it with an absolute url', async () => {
    const dir = copy()
    await run(dir)
    for (const [route, name] of [
      ['', 'index'],
      ['guide/a', 'guide/a'],
      ['guide/b', 'guide/b'],
    ] as const) {
      expect(size(join(dir, 'dist/og', `${name}.png`))).toEqual({ signature: 'PNG', width: 1200, height: 630 })
      const html = readFileSync(join(dir, 'dist', route, 'index.html'), 'utf8')
      expect(html).toContain(`<meta property="og:image" content="https://docs.test/og/${name}.png"`)
      for (const tag of ['og:title', 'og:url', 'og:type', 'og:image:width', 'og:image:height', 'og:image:alt'])
        expect(html).toContain(`<meta property="${tag}"`)
      expect(html).toContain('<meta name="twitter:card" content="summary_large_image"')
    }
  }, 60_000)

  it('a missing font file fails the build naming the file', async () => {
    const dir = copy()
    edit(dir, 'vite.config.ts', 'inter-700.woff', 'nope.woff')
    await expect(run(dir)).rejects.toThrow(/og: cannot read font file .*nope\.woff/)
  }, 60_000)

  it('images on without a site origin fail the build', async () => {
    const dir = copy()
    edit(dir, 'vite.config.ts', "og: { site: 'https://docs.test'", "og: { site: ''")
    await expect(run(dir)).rejects.toThrow(/og: `site`/)
  }, 60_000)

  it('with the switch off no image is written and no og:image is emitted', async () => {
    const dir = copy()
    edit(dir, 'vite.config.ts', /og: \{.*\},\n/, 'og: false,\n')
    edit(dir, 'site.tsx', 'OG_IMAGES = true', 'OG_IMAGES = false')
    await run(dir)
    expect(existsSync(join(dir, 'dist/og'))).toBe(false)
    const html = readFileSync(join(dir, 'dist/index.html'), 'utf8')
    expect(html).not.toContain('og:image')
    expect(html).toContain('<meta property="og:title"')
  }, 60_000)

  it('ogMeta without a site origin throws', () => {
    expect(() => ogMeta({ site: '', path: '/', name: 'index', title: 'T' })).toThrow(/site/)
  })
})
