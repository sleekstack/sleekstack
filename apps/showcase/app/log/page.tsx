/**
 * apps/showcase/app/log/page.tsx
 *
 * R6: the visible activity/finalizer log — request scope open/close (with
 * request id) and finalizer errors, in order. Component scope acquire/release
 * events are added in task .3.
 */
import { query } from '@sleekstack/next'
import { Effect } from 'effect'
import { ActivityLog } from '../../src/domain/tags'
import { demoEntries } from '../../src/server/demo.server'

async function loadLog() {
  const provide = await demoEntries()
  const logQuery = query({ provide }, () =>
    Effect.gen(function* () {
      const activityLog = yield* ActivityLog
      return activityLog.list()
    }),
  )
  return logQuery()
}

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
    </main>
  )
}
