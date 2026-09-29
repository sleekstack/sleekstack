/**
 * packages/cli/src/check.ts
 *
 * `sleekstack check`: a thin wrapper over `@sleekstack/analyze`. Roots are the `configureRuntime` calls in the
 * `--entry` files, else in the nearest package.json's `sleekstack.entry`, else every one outside test files; each
 * is validated independently. Exit 0 clean, 1 violations, 2 crash / usage. Under `--json` stdout carries only JSON: the
 * per-root result with its graph, plus every root module's graph and errors (`graphs`, `graphErrors`; unreached roots
 * never fail the check), which the showcase pages render as the prebuilt report.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { analyze, type AnalyzeError } from '@sleekstack/analyze'

const USAGE = 'Usage: sleekstack check [--project <tsconfig>] [--entry <file>...] [--json]'

interface Io { readonly cwd: string; readonly out: (s: string) => void; readonly err: (s: string) => void }
const stdio: Io = { cwd: process.cwd(), out: (s) => process.stdout.write(s + '\n'), err: (s) => process.stderr.write(s + '\n') }

/** `sleekstack.entry` (string or string[]) of the nearest package.json at or above `dir`, resolved against it. */
function configuredEntries(dir: string): string[] | undefined {
  for (let d = dir; ; d = path.dirname(d)) {
    const pj = path.join(d, 'package.json')
    if (fs.existsSync(pj)) {
      const entry = JSON.parse(fs.readFileSync(pj, 'utf8')).sleekstack?.entry
      return entry === undefined ? undefined : [entry].flat().map((f: string) => path.resolve(d, f))
    }
    if (path.dirname(d) === d) return undefined
  }
}

export function main(argv: readonly string[], io: Io = stdio): number {
  try {
    if (argv[0] !== 'check') return (io.err(USAGE), 2)
    let project = 'tsconfig.json'
    const entries: string[] = []
    let json = false
    for (let i = 1; i < argv.length; i++) {
      const a = argv[i]
      if (a === '--json') json = true
      else if ((a === '--project' || a === '--entry') && argv[i + 1]) a === '--project' ? (project = argv[++i]!) : entries.push(argv[++i]!)
      else return (io.err(`Unknown or incomplete argument "${a}"\n${USAGE}`), 2)
    }
    project = path.resolve(io.cwd, project)
    const report = analyze({
      project,
      entries: entries.length ? entries.map((f) => path.resolve(io.cwd, f)) : configuredEntries(path.dirname(project)),
    })
    if (report.runtimes.length === 0) return (io.err(`No roots: no configureRuntime call found (pass --entry or set "sleekstack.entry" in package.json).\n${USAGE}`), 2)
    const roots = report.runtimes.map((r) => ({ root: r.graph.root, file: r.file, line: r.line, nodes: r.graph.nodes.length, errors: r.errors, graph: r.graph }))
    const ok = report.extraction.length === 0 && roots.every((r) => r.errors.length === 0)
    const line = (e: AnalyzeError) => `  ${e.file}:${e.line} ${e.code}: ${e.message}`
    if (json) io.out(JSON.stringify({ ok, errors: report.extraction, roots, graphs: report.graphs, graphErrors: report.errors }, null, 2))
    else {
      report.extraction.forEach((e) => io.err(line(e)))
      for (const r of roots) io.err(`${r.errors.length ? 'FAIL' : 'ok  '} ${r.root} (${r.nodes} nodes)${r.errors.map((e) => '\n' + line(e)).join('')}`)
    }
    return ok ? 0 : 1
  } catch (e) {
    io.err(`sleekstack check crashed: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`)
    return 2
  }
}
