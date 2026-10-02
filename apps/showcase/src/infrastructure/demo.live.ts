/**
 * apps/showcase/src/infrastructure/demo.live.ts
 *
 * Demo-mode Layers: a mock ActivityLog and Clock. `runApp` provides `DemoLive`
 * as `runEffect` overrides, so the mocks shadow the real services per call.
 */
import 'server-only'
import { Layer } from 'effect'
import { ActivityLog, Clock, type ActivityEvent } from '../domain/tags'

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
