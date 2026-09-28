/**
 * apps/showcase/app/errors/page.tsx
 *
 * R3: builds each broken graph lazily and in isolation (one failing case
 * can't break the page), and shows the tagged error's `_tag` and message.
 * A case that fails to throw its expected tag renders "UNEXPECTED".
 */
import { errorCases, runCase, type CaseResult } from '../../src/errors/cases.server'

export default async function ErrorsPage() {
  // Sequential, one case at a time, each isolated by `runCase`: an unexpected
  // rejection (or wrong tag) from one runner never takes the whole page down.
  const results: { readonly case: (typeof errorCases)[number]; readonly result: CaseResult }[] = []
  for (const errorCase of errorCases) results.push({ case: errorCase, result: await runCase(errorCase) })

  return (
    <main>
      <h1>Error gallery</h1>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Case</th>
            <th>Tag</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {results.map(({ case: errorCase, result }) => (
            <tr key={errorCase.id}>
              <td>{errorCase.label}</td>
              <td>{result.tag}</td>
              <td>{result.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
