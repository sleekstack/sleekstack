/**
 * apps/showcase/src/infrastructure/runtime-infra.live.ts
 *
 * Live runtime infrastructure: `InfraLive` (Clock, IdGen) and `ActivityLogLive`.
 * Composed into `AppLive` by app.ts.
 */
import 'server-only'
import { Effect, Layer } from 'effect'
import type { ActivityEvent } from '../domain/tags'
import { ActivityLog, Clock, IdGen } from '../domain/tags'

export const SERVER_ONLY_MARKER = 'sleekstack-showcase-server-only-9d7b3e12'

let seq = 0
export const InfraLive = Layer.mergeAll(
  Layer.succeed(Clock, { now: () => Date.now() }),
  Layer.succeed(IdGen, { next: (prefix: string) => `${prefix}_${++seq}` }),
  Layer.effectDiscard(Effect.sync(() => console.log(SERVER_ONLY_MARKER, '[Infra] startup'))),
)

export const ActivityLogLive = Layer.effect(
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
