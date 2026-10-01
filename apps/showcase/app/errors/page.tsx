/**
 * apps/showcase/app/errors/page.tsx
 *
 * The error gallery: each broken plain-Layer runtime in src/errors/graphs.ts and the errors
 * the analyzer reported for it (file:line), read from the prebuilt `errors.json` report.
 */
import { readReport } from '../../src/server/report.server'

export default function ErrorsPage() {
  const rows = readReport('errors').roots.flatMap((r) => r.errors.map((e) => ({ root: r.root, ...e })))
  return (
    <main>
      <h1>Error gallery</h1>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Root</th>
            <th>Code</th>
            <th>Where</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.root}-${r.code}-${r.line}`}>
              <td>{r.root}</td>
              <td>{r.code}</td>
              <td>{`${r.file}:${r.line}`}</td>
              <td>{r.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
