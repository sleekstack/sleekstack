/**
 * apps/showcase/src/server/demo.server.ts
 *
 * Demo-mode toggle: a cookie read on the server. `DemoLive` holds a mock
 * ActivityLog and Clock; `runApp` provides it over the app's Layers when the
 * cookie is set, so the mocks shadow the real services for that operation.
 */
import 'server-only'
import { cookies } from 'next/headers'
import { Layer } from 'effect'
import { ActivityLog, Clock, type ActivityEvent } from '../domain/tags'
import { DEMO_COOKIE } from '../domain/demo-cookie'

export { DEMO_COOKIE }

export async function isDemoMode(): Promise<boolean> {
  const store = await cookies()
  return store.get(DEMO_COOKIE)?.value === '1'
}

let mockSeq = 0
const mockEvents: ActivityEvent[] = []

export const DemoLive = Layer.mergeAll(
  Layer.succeed(ActivityLog, {
    record: (message: string) => {
      mockEvents.push({ id: `mock_${++mockSeq}`, message: `[demo] ${message}`, at: 0 })
    },
    list: () => [...mockEvents],
  }),
  Layer.succeed(Clock, { now: () => 0 }),
)

/** Test-only peek at the mock's recorded events (requests.test.ts). */
export function __peekMockActivityEvents(): readonly ActivityEvent[] {
  return mockEvents
}
