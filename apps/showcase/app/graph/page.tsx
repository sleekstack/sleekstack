/**
 * apps/showcase/app/graph/page.tsx
 *
 * Renders the analyzer's prebuilt report: every root (app first, then `runEffect` request/overrides
 * layers) with its kind. Request/overrides graphs include the app graph they were checked over.
 */
import { readReport } from '../../src/server/report.server'

// Unknown kinds render as a plain root: the Report schema is additive.
const KINDS = new Set(['app', 'request', 'overrides', 'opaque'])

export default function GraphPage() {
  const roots = readReport('report').roots
  return (
    <main>
      <h1>Service graph</h1>
      {roots.map(({ root, kind, graph }, i) => (
        <section key={`${i}:${root}`}>
          <h2>
            {root}
            {kind && KINDS.has(kind) ? ` [${kind}]` : ''}
          </h2>
          <h3>Nodes</h3>
          <table border={1} cellPadding={4}>
            <thead>
              <tr>
                <th>Tag</th>
                <th>Lifetime</th>
              </tr>
            </thead>
            <tbody>
              {graph.nodes.map((node) => (
                <tr key={node.id}>
                  <td>{node.name}</td>
                  <td>{node.lifetime}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Edges</h3>
          <table border={1} cellPadding={4}>
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
              </tr>
            </thead>
            <tbody>
              {graph.edges.map((edge) => (
                <tr key={`${edge.from}-${edge.to}-${edge.tag}`}>
                  <td>{edge.from}</td>
                  <td>{edge.to}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </main>
  )
}
