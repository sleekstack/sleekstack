/**
 * apps/showcase-kit/src/server/demo.server.ts
 *
 * Demo mode: a cookie read on the server. `demoLayers()` returns a mock
 * ActivityLog and Clock passed as per-call `provide`, Shadowing the runtime graph.
 */
import 'server-only'
import { cookies } from 'next/headers'
import { layer, type Layer } from '@sleekstack/kit'
import { ActivityLog, Clock, type ActivityEvent } from '../domain/tags'
import { DEMO_COOKIE } from '../domain/demo-cookie'

export async function isDemoMode(): Promise<boolean> {
  return (await cookies()).get(DEMO_COOKIE)?.value === '1'
}

let mockSeq = 0
const mockEvents: ActivityEvent[] = []

export const MockActivityLogLayer = layer(ActivityLog, {
  record: (message: string) => void mockEvents.push({ id: `mock_${++mockSeq}`, message: `[demo] ${message}`, at: 0 }),
  list: () => [...mockEvents],
})

export const MockClockLayer = layer(Clock, { now: () => 0 })

/** Per-call `provide`; empty (no Shadowing) when demo mode is off. */
export async function demoLayers(): Promise<readonly Layer<any>[]> {
  return (await isDemoMode()) ? [MockActivityLogLayer, MockClockLayer] : []
}

/** Test-only peek at the mock's recorded events. */
export function __peekMockActivityEvents(): readonly ActivityEvent[] {
  return mockEvents
}
