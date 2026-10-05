/**
 * apps/showcase-kit/app/errors/page.tsx
 *
 * Graph errors come from the analyzer's prebuilt report (file:line in src/errors/graphs.ts);
 * runtime-only errors are thrown in isolation via the kit API. Shows each `code` and message
 * (UNEXPECTED when a case misbehaves).
 */
import { buildTimeResults, errorCases, runCase } from '../../src/errors/cases.server'
import { readReport } from '../../src/server/report.server'

export default async function ErrorsPage() {
  const results: { id: string; code: string; message: string; at: string }[] = buildTimeResults(
    readReport().graphErrors,
  )
  for (const c of errorCases) results.push({ id: c.id, ...(await runCase(c)), at: 'runtime' })
  return (
    <main>
      <h1>Error gallery</h1>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Case</th>
            <th>Code</th>
            <th>Where</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.code}</td>
              <td>{r.at}</td>
              <td>{r.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
