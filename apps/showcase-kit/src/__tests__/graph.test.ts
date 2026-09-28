/**
 * apps/showcase-kit/src/__tests__/graph.test.ts
 *
 * R8: kit snapshot(AppModule) renders the app graph in core's shape.
 */
import { module, snapshot } from '@sleekstack/kit'
import { expect, it } from 'vitest'
import { AppModule } from '../domain/modules.server'
import { MockActivityLogLayer, MockClockLayer } from '../server/demo.server'

it('snapshots the app graph: modules, private Store, edges, no shadowing', () => {
  const snap = snapshot(AppModule)
  expect(new Set(snap.nodes.map((n) => n.module?.name))).toEqual(new Set(['Infra', 'Data', 'Activity', 'App']))
  expect(snap.nodes.filter((n) => n.private).map((n) => n.name)).toEqual(['Store'])
  expect(snap.edges.filter((e) => e.from === 'TaskRepo').map((e) => e.to).sort()).toEqual(['Clock', 'IdGen', 'Store'])
  expect(snap.shadowing).toHaveLength(0)
})

it('demo mode shadows ActivityLog and Clock', () => {
  const snap = snapshot(module({ name: 'Demo', imports: [AppModule], provide: [MockActivityLogLayer, MockClockLayer] }))
  expect(snap.shadowing.map((s) => s.tag).sort()).toEqual(['ActivityLog', 'Clock'])
})
