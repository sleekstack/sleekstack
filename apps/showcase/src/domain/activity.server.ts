/**
 * apps/showcase/src/domain/activity.server.ts
 *
 * ActivityLog (R1, R6): a raw Effect Layer wrapped with `declareLayer` — the
 * graph's one declared node — rather than a `service()` definition, so the
 * showcase exercises both entry kinds. Requires Clock (from Infra) to
 * timestamp events, which is why the Activity module imports Infra.
 */
import 'server-only'
import { declareLayer } from '@sleekstack/core'
import { Effect, Layer } from 'effect'
import { ActivityLog, Clock } from './tags'
import type { ActivityEvent } from './tags'

export const SERVER_ONLY_MARKER = 'sleekstack-showcase-server-only-9d7b3e12'

const rawActivityLogLayer = Layer.effect(
  ActivityLog,
  Effect.map(Clock, (clock) => {
    const events: ActivityEvent[] = []
    let seq = 0
    return {
      record: (message: string) => {
        events.push({ id: `evt_${++seq}`, message, at: clock.now() })
      },
      list: () => [...events],
    }
  }),
)

export const ActivityLogDecl = declareLayer(rawActivityLogLayer, { provides: [ActivityLog], requires: [Clock] })
