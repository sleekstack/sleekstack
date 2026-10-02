/**
 * apps/showcase/app/graph/page.tsx
 *
 * Renders the analyzer's prebuilt report for the app runtime root (`configureRuntime({ layer: AppLive })`).
 */
import { readReport } from '../../src/delivery/report.server'

export default function GraphPage() {
  const graph = readReport('report').roots[0]!.graph
  return (
    <main>
      <h1>Service graph</h1>
      <h2>Nodes</h2>
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
      <h2>Edges</h2>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>From</th>
            <th>To</th>
          </tr>
        </thead>
        <tbody>
          {graph.edges.map((edge) => (
            <tr key={`${edge.from}-${edge.to}`}>
              <td>{edge.from}</td>
              <td>{edge.to}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
