/**
 * apps/showcase-kit/src/server/report.server.ts
 *
 * The analyzer's prebuilt report (`pnpm report`, run by predev / prebuild: `sleekstack check --json`),
 * read at render time. The graph and errors pages render it; nothing here executes the graph.
 */
import 'server-only'
import { readFileSync } from 'node:fs'
import path from 'node:path'

export interface ReportNode { readonly id: string; readonly name: string; readonly lifetime: 'app' | 'request' | 'component'; readonly module: { readonly name: string } | null; readonly private: boolean; readonly shadowed: boolean }
export interface ReportGraph {
  readonly root: string
  readonly nodes: readonly ReportNode[]
  readonly edges: readonly { readonly from: string; readonly to: string; readonly tag: string }[]
  readonly shadowing: readonly { readonly tag: string; readonly winner: string; readonly shadowed: readonly string[] }[]
}
export interface ReportError { readonly code: string; readonly message: string; readonly file: string; readonly line: number }
export interface Report {
  readonly ok: boolean
  readonly roots: readonly { readonly root: string; readonly graph: ReportGraph; readonly errors: readonly ReportError[] }[]
  readonly graphs: readonly ReportGraph[]
  readonly graphErrors: readonly ReportError[]
}

export const REPORT_PATH = '.sleekstack/report.json'

export function readReport(dir = process.cwd()): Report {
  return JSON.parse(readFileSync(path.join(dir, REPORT_PATH), 'utf8')) as Report
}
