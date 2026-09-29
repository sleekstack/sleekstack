/**
 * apps/showcase-kit/app/graph/page.tsx
 *
 * Renders the analyzer's prebuilt report: the runtime root's graph, or in demo mode the `Demo`
 * root (demo.server.ts), where the mock ActivityLog/Clock shadow the imported ones.
 */
import { isDemoMode } from '../../src/server/demo.server'
import { readReport } from '../../src/server/report.server'

export default async function GraphPage() {
  const report = readReport()
  const snap = (await isDemoMode()) ? report.graphs.find((g) => g.root === 'Demo')! : report.roots[0]!.graph
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
          {snap.edges.map((edge) => (
            <tr key={`${edge.from}-${edge.to}`}>
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
