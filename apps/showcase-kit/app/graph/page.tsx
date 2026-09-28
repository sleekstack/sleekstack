/**
 * apps/showcase-kit/app/graph/page.tsx
 *
 * Renders kit `snapshot(AppModule)` (core's snapshot shape, R8). In demo mode
 * the mock ActivityLog/Clock are provided at the root, shadowing the imported ones.
 */
import { module, snapshot } from '@sleekstack/kit'
import { AppModule } from '../../src/domain/modules.server'
import { isDemoMode, MockActivityLogLayer, MockClockLayer } from '../../src/server/demo.server'

export default async function GraphPage() {
  const app = (await isDemoMode()) ? module({ name: 'Demo', imports: [AppModule], provide: [MockActivityLogLayer, MockClockLayer] }) : AppModule
  const snap = snapshot(app)
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
