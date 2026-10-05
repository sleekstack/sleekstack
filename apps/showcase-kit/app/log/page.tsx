/**
 * apps/showcase-kit/app/log/page.tsx
 *
 * The activity/finalizer log (request open/close, finalizer errors) next to
 * the client-side ScopeLog.
 */
import { query } from '@sleekstack/kit/next'
import { ActivityLog } from '../../src/domain/tags'
import { demoLayers } from '../../src/server/demo.server'
import { ScopeLog } from '../../src/client/ScopeLog'

export default async function LogPage() {
  const events = await query(
    function* () {
      return (yield* ActivityLog).list()
    },
    { provide: demoLayers },
  )
  return (
    <main>
      <h1>Activity log</h1>
      <ol>
        {events.map((event) => (
          <li key={event.id}>
            <time dateTime={new Date(event.at).toISOString()}>{new Date(event.at).toISOString()}</time> —{' '}
            {event.message}
          </li>
        ))}
      </ol>
      <ScopeLog />
    </main>
  )
}
