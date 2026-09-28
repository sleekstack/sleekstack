/**
 * apps/showcase/src/__tests__/graph.test.ts
 *
 * Early proof point (R1, R11): the whole app graph builds and snapshots
 * under Next's toolchain, and the shapes the plan calls for (≥3 modules,
 * one thunk import, one private node, one declared node, one opaque node)
 * are all present.
 */
import { buildGraph, snapshot } from '@sleekstack/core'
import { describe, expect, it } from 'vitest'
import { AppModule, appEntries } from '../domain/modules.server'

describe('showcase domain graph', () => {
  it('imports Data and Activity through a thunk', () => {
    expect(typeof AppModule.imports).toBe('function')
    const imports = (AppModule.imports as () => readonly unknown[])()
    expect(imports).toHaveLength(2)
  })

  it('builds and snapshots with the required node shapes', () => {
    const graph = buildGraph(appEntries)
    const snap = snapshot(graph)

    // >= 3 modules: Infra, Data, Activity, App.
    const moduleNames = new Set(snap.nodes.map((n) => n.module?.name).filter((m): m is string => m !== undefined))
    expect(moduleNames.size).toBeGreaterThanOrEqual(3)

    // One private *named* node (Store, kept out of Data's exports). Opaque bare Layers are
    // always private when they belong to a module (they have no Tag to export), so they're
    // excluded here — that's a separate, always-true flag, not the one this checks.
    const privateNamedNodes = snap.nodes.filter((n) => n.private && !n.opaque)
    expect(privateNamedNodes).toHaveLength(1)
    expect(privateNamedNodes[0]!.name).toBe('Store')

    // One declared node (ActivityLog via declareLayer).
    const activityNode = snap.nodes.find((n) => n.name === 'ActivityLog')
    expect(activityNode).toBeDefined()
    expect(activityNode!.opaque).toBe(false)

    // One opaque node (the Infra startup bare Layer).
    const opaqueNodes = snap.nodes.filter((n) => n.opaque)
    expect(opaqueNodes).toHaveLength(1)

    // No shadowing in the plain (non-demo-mode) graph.
    expect(snap.shadowing).toHaveLength(0)
  })

  it('has edges from TaskRepo to Store/IdGen/Clock', () => {
    const snap = snapshot(buildGraph(appEntries))
    const taskRepoEdges = snap.edges.filter((e) => e.from === 'TaskRepo')
    expect(taskRepoEdges.map((e) => e.to).sort()).toEqual(['Clock', 'IdGen', 'Store'])
  })
})
