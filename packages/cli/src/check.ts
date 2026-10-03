/**
 * packages/cli/src/check.ts
 *
 * `sleekstack check`: a thin wrapper over `@sleekstack/analyze`. Roots are the `configureRuntime` calls in the
 * `--entry` files, else in the nearest package.json's `sleekstack.entry`, else every one outside test files; each
 * is validated independently. Exit 0 clean, 1 violations, 2 crash / usage. Under `--json` stdout carries only JSON: the
 * per-root result with its graph, plus every root module's graph and errors (`graphs`, `graphErrors`; unreached roots
 * never fail the check), which the showcase pages render as the prebuilt report. `runEffect({ request, overrides })`
 * layers are further roots (`kind`); `--lenient` turns an unresolvable one into an opaque root instead of a failure.
 * A project whose package.json lists `@sleekstack/ui` also runs the component pass (`components` under `--json`);
 * its `mount` trees count as roots.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { analyze, analyzeComponents, type AnalyzeError, type ComponentReport } from '@sleekstack/analyze'

const USAGE = 'Usage: sleekstack check [--project <tsconfig>] [--entry <file>...] [--json] [--lenient]'

interface Io { readonly cwd: string; readonly out: (s: string) => void; readonly err: (s: string) => void }
const stdio: Io = { cwd: process.cwd(), out: (s) => process.stdout.write(s + '\n'), err: (s) => process.stderr.write(s + '\n') }

/** The nearest package.json at or above `dir`, parsed, with its directory. */
function nearestPackage(dir: string): { dir: string; pkg: any } | undefined {
  for (let d = dir; ; d = path.dirname(d)) {
    const pj = path.join(d, 'package.json')
    if (fs.existsSync(pj)) return { dir: d, pkg: JSON.parse(fs.readFileSync(pj, 'utf8')) }
    if (path.dirname(d) === d) return undefined
  }
}

/** `sleekstack.entry` (string or string[]) of the nearest package.json, resolved against it. */
function configuredEntries(dir: string): string[] | undefined {
  const near = nearestPackage(dir)
  const entry = near?.pkg.sleekstack?.entry
  return entry === undefined ? undefined : [entry].flat().map((f: string) => path.resolve(near!.dir, f))
}

/** The `@sleekstack/ui` component pass, only when the nearest package.json lists `@sleekstack/ui` (R8). */
function components(project: string): ComponentReport | undefined {
  const pkg = nearestPackage(path.dirname(project))?.pkg
  const listed = ['dependencies', 'devDependencies', 'peerDependencies'].some((k) => pkg?.[k]?.['@sleekstack/ui'] !== undefined)
  return listed ? analyzeComponents({ project }) : undefined
}

export function main(argv: readonly string[], io: Io = stdio): number {
  try {
    if (argv[0] !== 'check') return (io.err(USAGE), 2)
    let project = 'tsconfig.json'
    const entries: string[] = []
    let json = false
    let lenient = false
    for (let i = 1; i < argv.length; i++) {
      const a = argv[i]
      if (a === '--json') json = true
      else if (a === '--lenient') lenient = true
      else if ((a === '--project' || a === '--entry') && argv[i + 1]) a === '--project' ? (project = argv[++i]!) : entries.push(argv[++i]!)
      else return (io.err(`Unknown or incomplete argument "${a}"\n${USAGE}`), 2)
    }
    project = path.resolve(io.cwd, project)
    const report = analyze({
      project,
      entries: entries.length ? entries.map((f) => path.resolve(io.cwd, f)) : configuredEntries(path.dirname(project)),
      lenient,
    })
    const ui = components(project)
    if (report.runtimes.length === 0 && !ui?.trees.length) return (io.err(`No roots: no configureRuntime call found (pass --entry or set "sleekstack.entry" in package.json).\n${USAGE}`), 2)
    const roots = report.runtimes.map((r) => ({ kind: r.kind, root: r.graph.root, file: r.file, line: r.line, nodes: r.graph.nodes.length, errors: r.errors, graph: r.graph }))
    const ok = report.extraction.length === 0 && roots.every((r) => r.errors.length === 0) && !ui?.errors.length
    const line = (e: AnalyzeError) => `  ${e.file}:${e.line} ${e.code}: ${e.message}`
    if (json) io.out(JSON.stringify({ ok, errors: report.extraction, roots, graphs: report.graphs, graphErrors: report.errors, ...(ui && { components: ui }) }, null, 2))
    else {
      report.extraction.forEach((e) => io.err(line(e)))
      for (const r of roots) io.err(`${r.errors.length ? 'FAIL' : 'ok  '} [${r.kind}] ${r.root} (${r.nodes} nodes)${r.errors.map((e) => '\n' + line(e)).join('')}`)
      ui?.errors.forEach((e) => io.err(line(e)))
    }
    return ok ? 0 : 1
  } catch (e) {
    io.err(`sleekstack check crashed: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`)
    return 2
  }
}
