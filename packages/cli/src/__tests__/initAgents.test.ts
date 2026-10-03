import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { main } from '../check'

let dir: string
const run = (...args: string[]) => {
  let out = ''
  let err = ''
  const code = main(['init-agents', ...args], { cwd: dir, out: (s) => (out += s), err: (s) => (err += s) })
  return { code, out, err }
}
const agents = () => path.join(dir, 'AGENTS.md')

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-init-'))
  fs.mkdirSync(path.join(dir, 'node_modules/@sleekstack/kit'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'node_modules/@sleekstack/kit/llms.md'), '# kit')
})
afterEach(() => {
  fs.chmodSync(dir, 0o755)
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('sleekstack init-agents', () => {
  it('creates the block, then is idempotent and keeps surrounding text', () => {
    fs.writeFileSync(agents(), '# Mine\n\nkeep me\n')
    expect(run().code).toBe(0)
    const once = fs.readFileSync(agents(), 'utf8')
    expect(once).toMatch(/^# Mine\n\nkeep me\n\n<!-- sleekstack:agents:start -->[\s\S]*node_modules\/@sleekstack\/kit\/llms\.md[\s\S]*<!-- sleekstack:agents:end -->\n$/)
    expect(run().out).toMatch(/up to date/)
    fs.appendFileSync(agents(), 'after\n')
    expect(run().code).toBe(0)
    expect(fs.readFileSync(agents(), 'utf8')).toBe(`${once}after\n`)
  })

  it('stops on unbalanced or duplicate markers without writing', () => {
    for (const bad of ['<!-- sleekstack:agents:start -->\n', '<!-- sleekstack:agents:end -->\n<!-- sleekstack:agents:start -->\n',
      '<!-- sleekstack:agents:start -->\n<!-- sleekstack:agents:end -->\n<!-- sleekstack:agents:start -->\n<!-- sleekstack:agents:end -->\n']) {
      fs.writeFileSync(agents(), bad)
      const r = run()
      expect(r.code).toBe(2)
      expect(r.err).toMatch(/unbalanced or duplicate/)
      expect(fs.readFileSync(agents(), 'utf8')).toBe(bad)
    }
  })

  it('preserves CRLF line endings', () => {
    fs.writeFileSync(agents(), '# Mine\r\nline\r\n')
    expect(run().code).toBe(0)
    expect(fs.readFileSync(agents(), 'utf8').replace(/\r\n/g, '')).not.toContain('\n')
  })

  it('reports a read-only directory clearly', () => {
    if (process.getuid?.() === 0) return
    fs.chmodSync(dir, 0o555)
    const r = run()
    expect(r.code).toBe(2)
    expect(r.err).toMatch(/permission denied/)
  })

  it('fails when @sleekstack/kit is not installed', () => {
    fs.rmSync(path.join(dir, 'node_modules'), { recursive: true })
    expect(run().err).toMatch(/install @sleekstack\/kit/)
  })
})
