/**
 * apps/showcase-kit/src/__tests__/parity.test.ts
 *
 * The analyzer's graph (the `sleekstack check --json` report the graph page renders) for the app
 * root and the Demo root. Before `snapshot` was deleted (fn-9 task 7) this asserted equality with
 * kit `snapshot(AppModule)`; the values below are what that parity pinned.
 */
import path from 'node:path'
import { main } from 'sleekstack/src/check'
import { describe, expect, it } from 'vitest'
import type { Report } from '../server/report.server'

let out = ''
const code = main(['check', '--json', '--entry', 'src/server/runtime.server.ts'], { cwd: path.join(__dirname, '../..'), out: (s) => (out += s), err: () => {} })
const report = JSON.parse(out) as Report

describe('analyzer graph of the app', () => {
  it('the runtime root (configureRuntime({ provide: [AppModule] })): modules, private Store, edges, no shadowing', () => {
    expect(code).toBe(0)
    expect(report.roots).toHaveLength(1)
    const g = report.roots[0]!.graph
    expect(g.nodes.length).toBeGreaterThan(5)
    expect(new Set(g.nodes.map((n) => n.module?.name))).toEqual(new Set(['Infra', 'Data', 'Activity', 'App']))
    expect(g.nodes.filter((n) => n.private).map((n) => n.id)).toEqual(['Store'])
    expect(g.edges.filter((e) => e.from === 'TaskRepo').map((e) => e.to).sort()).toEqual(['Clock', 'IdGen', 'Store'])
    expect(g.shadowing).toHaveLength(0)
  })

  it('the Demo root, whose mocks shadow ActivityLog and Clock', () => {
    const demo = report.graphs.find((g) => g.root === 'Demo')!
    expect(demo.shadowing.map((s) => s.tag).sort()).toEqual(['ActivityLog', 'Clock'])
  })
})
