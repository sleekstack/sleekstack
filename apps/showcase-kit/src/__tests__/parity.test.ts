/**
 * apps/showcase-kit/src/__tests__/parity.test.ts
 *
 * R9 gate for deleting `snapshot`: the analyzer's graph (the `sleekstack check --json` report the
 * graph page renders) equals kit `snapshot(AppModule)` on nodes, edges, private Tags and shadowing,
 * and the Demo root equals `snapshot(DemoModule)`. Keyed so a mismatch names the differing node or edge.
 */
import path from 'node:path'
import { snapshot } from '@sleekstack/kit'
import { main } from 'sleekstack/src/check'
import { describe, expect, it } from 'vitest'
import { AppModule } from '../domain/modules.server'
import { DemoModule } from '../server/demo.server'
import type { Report, ReportGraph } from '../server/report.server'

let out = ''
const code = main(['check', '--json'], { cwd: path.join(__dirname, '../..'), out: (s) => (out += s), err: () => {} })
const report = JSON.parse(out) as Report

const shape = (g: ReportGraph | ReturnType<typeof snapshot>) => ({
  nodes: Object.fromEntries(g.nodes.map((n) => [n.id, { name: n.name, module: n.module?.name ?? null, lifetime: n.lifetime, private: n.private, shadowed: n.shadowed }])),
  edges: g.edges.map((e) => `${e.from} -> ${e.to} (${e.tag})`).sort(),
  private: g.nodes.filter((n) => n.private).map((n) => n.id).sort(),
  shadowing: Object.fromEntries(g.shadowing.map((s) => [s.tag, { winner: s.winner, shadowed: [...s.shadowed].sort() }])),
})

describe('parity: analyzer graph == snapshot', () => {
  it('the runtime root (configureRuntime({ provide: [AppModule] }))', () => {
    expect(code).toBe(0)
    expect(report.roots).toHaveLength(1)
    const g = shape(report.roots[0]!.graph)
    expect(g).toEqual(shape(snapshot(AppModule)))
    expect(Object.keys(g.nodes).length).toBeGreaterThan(5)
    expect(g.private).toEqual(['Store'])
  })

  it('the Demo root, whose mocks shadow ActivityLog and Clock', () => {
    const demo = report.graphs.find((g) => g.root === 'Demo')!
    expect(shape(demo)).toEqual(shape(snapshot(DemoModule)))
    expect(demo.shadowing.map((s) => s.tag).sort()).toEqual(['ActivityLog', 'Clock'])
  })
})
