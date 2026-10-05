/**
 * packages/devtools/src/panel/sections.tsx
 *
 * Panel sections for traced service acquire/release and errors linked to their scope.
 */

export interface DevEvent {
  readonly at: number
  readonly kind: string
  readonly label: string
  readonly detail?: string
  readonly scope?: string
  readonly fiber?: string
}

const SHOWN = 20

/** Per-service acquire/release, newest last, with owning scope and fiber. */
export function ServiceEvents({ events }: { readonly events: readonly DevEvent[] }) {
  const lifecycle = events.filter((e) => e.kind === 'acquire' || e.kind === 'release').slice(-SHOWN)
  return (
    <section aria-label="services">
      <h3>Service acquire/release</h3>
      {lifecycle.length === 0 ? (
        <p>No service events recorded.</p>
      ) : (
        <ul>
          {lifecycle.map((e, i) => (
            <li key={`${e.at}-${i}`}>
              {`${e.kind} ${e.label}${e.scope ? ` in ${e.scope}` : ''}${e.fiber ? ` (${e.fiber})` : ''}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Recent errors, each with its scope and whether that scope is still open. */
export function ScopedErrors({
  errors,
  live,
}: {
  readonly errors: readonly DevEvent[]
  readonly live: readonly string[]
}) {
  return (
    <section aria-label="errors">
      <h3>Errors</h3>
      {errors.length === 0 ? (
        <p>No errors recorded.</p>
      ) : (
        <ul>
          {errors.slice(-10).map((e, i) => (
            <li key={`${e.at}-${i}`}>
              {e.scope && <p>{`scope: ${e.scope} (${live.includes(e.scope) ? 'open' : 'closed'})`}</p>}
              <pre>{e.detail ?? e.label}</pre>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
