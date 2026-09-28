/**
 * apps/showcase-kit/app/errors/page.tsx
 *
 * Each broken graph is built in isolation via the kit API; shows the
 * SleekStackError `code` and message (UNEXPECTED when a case misbehaves).
 */
import { errorCases, runCase } from '../../src/errors/cases.server'

export default async function ErrorsPage() {
  const results = []
  for (const c of errorCases) results.push({ id: c.id, ...(await runCase(c)) })
  return (
    <main>
      <h1>Error gallery</h1>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Case</th>
            <th>Code</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.code}</td>
              <td>{r.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
