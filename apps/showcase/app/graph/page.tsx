/**
 * apps/showcase/app/graph/page.tsx
 *
 * R2: renders snapshot(buildGraph(appEntries)) as an HTML table — nodes per
 * Tag, edges, lifetime, owning module, private flag and shadowing.
 */
import { buildGraph, snapshot, type GraphSnapshot } from '@sleekstack/core'
import { appEntries } from '../../src/domain/modules.server'
import { isDemoMode, MockActivityLogDef, MockClockDef } from '../../src/server/demo.server'

/** Demo mode (R9): the mock ActivityLog/Clock shadow the real ones, shown in the Shadowing section below. */
function buildAppSnapshot(demo: boolean): GraphSnapshot {
  return snapshot(buildGraph(demo ? [...appEntries, MockActivityLogDef, MockClockDef] : appEntries))
}

export default async function GraphPage() {
  // Same server-side cookie check as demoEntries() (R9): a query param here would let
  // this page disagree with what the board's queries/actions actually shadowed.
  const snap = buildAppSnapshot(await isDemoMode())

  return (
    <main>
      <h1>Service graph</h1>
      <h2>Nodes</h2>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Tag</th>
            <th>Module</th>
            <th>Lifetime</th>
            <th>Private</th>
            <th>Opaque</th>
            <th>Shadowed</th>
          </tr>
        </thead>
        <tbody>
          {snap.nodes.map((node) => (
            <tr key={node.id}>
              <td>{node.name}</td>
              <td>{node.module?.name ?? '(root)'}</td>
              <td>{node.lifetime}</td>
              <td>{node.private ? 'yes' : 'no'}</td>
              <td>{node.opaque ? 'yes' : 'no'}</td>
              <td>{node.shadowed ? 'yes' : 'no'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Edges</h2>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>From</th>
            <th>To</th>
          </tr>
        </thead>
        <tbody>
          {snap.edges.map((edge, i) => (
            // eslint-disable-next-line react/no-array-index-key -- edges have no stable id of their own
            <tr key={`${edge.from}-${edge.to}-${i}`}>
              <td>{edge.from}</td>
              <td>{edge.to}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {snap.shadowing.length > 0 && (
        <>
          <h2>Shadowing</h2>
          <ul>
            {snap.shadowing.map((s) => (
              <li key={s.tag}>
                {s.tag}: {s.winner} shadows {s.shadowed.join(', ')}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
