/**
 * apps/showcase/app/log/page.tsx
 *
 * R6: the visible activity/finalizer log — request scope open/close (with
 * request id) and finalizer errors, in order — shown next to `ScopeLog`
 * (task .3), the client-side list fed by component-scope acquire/release.
 * A client component in a server page: since route navigation here is a
 * client-side transition, `ScopeLog`'s module-scope event list survives the
 * trip from the board, so events recorded while a task detail was open are
 * still visible after navigating to /log.
 */
import { Effect } from 'effect'
import { ActivityLog } from '../../src/domain/tags'
import { runApp } from '../../src/delivery/runtime.server'
import { ScopeLog } from '../../src/client/components/ScopeLog'

const loadLog = () =>
  runApp(
    Effect.gen(function* () {
      const activityLog = yield* ActivityLog
      return activityLog.list()
    }),
  )

export default async function LogPage() {
  const events = await loadLog()

  return (
    <main>
      <h1>Activity log</h1>
      <ol>
        {events.map((event) => (
          <li key={event.id}>
            <time dateTime={new Date(event.at).toISOString()}>{new Date(event.at).toISOString()}</time> — {event.message}
          </li>
        ))}
      </ol>
      <ScopeLog />
    </main>
  )
}
