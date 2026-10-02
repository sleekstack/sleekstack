/**
 * apps/showcase/src/server/report.server.ts
 *
 * The analyzer's prebuilt reports (`pnpm report`, run by predev / prebuild): `report.json` for the
 * app runtime (runtime.server.ts), `errors.json` for the broken fixtures (src/errors/graphs.ts).
 * Read at render time; nothing here executes a graph.
 */
import 'server-only'
import { readFileSync } from 'node:fs'
import path from 'node:path'

export interface ReportNode { readonly id: string; readonly name: string; readonly lifetime: string }
export interface ReportGraph {
  readonly root: string
  readonly nodes: readonly ReportNode[]
  readonly edges: readonly { readonly from: string; readonly to: string; readonly tag: string }[]
}
export interface ReportError { readonly code: string; readonly message: string; readonly file: string; readonly line: number }
export interface Report {
  readonly ok: boolean
  readonly roots: readonly {
    readonly root: string
    /** 'app' | 'request' | 'overrides' | 'opaque'; other values are shown as-is (additive schema). */
    readonly kind?: string
    readonly graph: ReportGraph; readonly errors: readonly ReportError[]
  }[]
}

export function readReport(name: 'report' | 'errors', dir = process.cwd()): Report {
  return JSON.parse(readFileSync(path.join(dir, '.sleekstack', `${name}.json`), 'utf8')) as Report
}
