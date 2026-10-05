/**
 * packages/cli/src/initAgents.ts
 *
 * `sleekstack init-agents [--file <path>]`: writes (or refreshes) a marked block in AGENTS.md pointing agents at
 * the `llms.md` bundled with `@sleekstack/kit`. Idempotent; the rest of the file is untouched. Exit codes as in check.ts.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const START = '<!-- sleekstack:agents:start -->'
const END = '<!-- sleekstack:agents:end -->'
const USAGE = 'Usage: sleekstack init-agents [--file <AGENTS.md>]'

interface Io {
  readonly cwd: string
  readonly out: (s: string) => void
  readonly err: (s: string) => void
}

/** `node_modules/@sleekstack/kit/llms.md` as node resolution finds it from `dir` (symlinks kept, so the path is stable across versions). */
function findLlms(dir: string): string | undefined {
  for (let d = dir; ; d = path.dirname(d)) {
    const f = path.join(d, 'node_modules', '@sleekstack', 'kit', 'llms.md')
    if (fs.existsSync(f)) return f
    if (path.dirname(d) === d) return undefined
  }
}

const count = (s: string, m: string) => s.split(m).length - 1

export function initAgents(argv: readonly string[], io: Io): number {
  let file = 'AGENTS.md'
  if (argv.length === 2 && argv[0] === '--file') file = argv[1]!
  else if (argv.length) return (io.err(USAGE), 2)
  file = path.resolve(io.cwd, file)

  const llms = findLlms(path.dirname(file))
  if (!llms) return (io.err('Cannot find @sleekstack/kit/llms.md: install @sleekstack/kit first.'), 2)
  const rel = path.relative(path.dirname(file), llms).split(path.sep).join('/')

  const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  const eol = old.includes('\r\n') ? '\r\n' : '\n'
  const block = [
    START,
    '## SleekStack',
    '',
    `Before writing or changing SleekStack code, read \`${rel}\` (API, patterns, lifetime rules, error codes).`,
    'After a change, run `npx sleekstack check`; `npx sleekstack explain <CODE>` explains a failure.',
    END,
  ].join(eol)

  const starts = count(old, START)
  const ends = count(old, END)
  let next: string
  if (starts === 0 && ends === 0)
    next = old ? `${old.replace(/(\r?\n)*$/, '')}${eol}${eol}${block}${eol}` : `${block}${eol}`
  else if (starts === 1 && ends === 1 && old.indexOf(START) < old.indexOf(END))
    next = old.slice(0, old.indexOf(START)) + block + old.slice(old.indexOf(END) + END.length)
  else
    return (
      io.err(
        `${file}: unbalanced or duplicate sleekstack markers (${starts} start, ${ends} end); fix them by hand and re-run.`,
      ),
      2
    )

  if (next === old) return (io.out(`${path.basename(file)} is up to date.`), 0)
  const tmp = `${file}.${process.pid}.tmp`
  try {
    fs.writeFileSync(tmp, next)
    fs.renameSync(tmp, file)
  } catch (e) {
    fs.rmSync(tmp, { force: true })
    const code = (e as NodeJS.ErrnoException).code
    return (
      io.err(
        `Cannot write ${file}${code === 'EACCES' || code === 'EPERM' || code === 'EROFS' ? ': permission denied (read-only?)' : `: ${(e as Error).message}`}`,
      ),
      2
    )
  }
  io.out(`Wrote the SleekStack block to ${path.basename(file)}.`)
  return 0
}
