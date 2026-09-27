/**
 * apps/showcase/src/server/demo.server.ts
 *
 * Demo-mode toggle (R9): a cookie read on the server. `demoEntries()` returns
 * a mock ActivityLog and Clock passed as per-call `provide` on both server
 * operations (this file) and the client `LayerProvider` remount (task .3) —
 * the only override path, no separate demo API.
 */
import 'server-only'
import { cookies } from 'next/headers'
import { service, type Entry } from '@sleekstack/core'
import { Effect } from 'effect'
import { ActivityLog, Clock, type ActivityEvent } from '../domain/tags'

export const DEMO_COOKIE = 'sleekstack_demo'

export async function isDemoMode(): Promise<boolean> {
  const store = await cookies()
  return store.get(DEMO_COOKIE)?.value === '1'
}

let mockSeq = 0
const mockEvents: ActivityEvent[] = []

export const MockActivityLogDef = service(ActivityLog, {}, () =>
  Effect.succeed({
    record: (message: string) => {
      mockEvents.push({ id: `mock_${++mockSeq}`, message: `[demo] ${message}`, at: 0 })
    },
    list: () => [...mockEvents],
  }),
)

export const MockClockDef = service(Clock, {}, () => Effect.succeed({ now: () => 0 }))

/** Per-call `provide` override for server operations; empty (no shadowing) when demo mode is off. */
export async function demoEntries(): Promise<readonly Entry[]> {
  return (await isDemoMode()) ? [MockActivityLogDef, MockClockDef] : []
}

/** Test-only peek at the mock's recorded events (requests.test.ts, R9). */
export function __peekMockActivityEvents(): readonly ActivityEvent[] {
  return mockEvents
}
