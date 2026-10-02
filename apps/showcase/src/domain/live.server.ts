/**
 * apps/showcase/src/domain/live.server.ts
 *
 * The app's Layers, plain Effect: Infra (Clock, IdGen) -> BoardStore +
 * ActivityLog. `AppLive` is what the server ManagedRuntime builds once.
 */
import 'server-only'
import { Effect, Layer } from 'effect'
import { BoardStoreLive } from '../infrastructure/board-store.memory'
import type { ActivityEvent } from './tags'
import { ActivityLog, Clock, IdGen } from './tags'

export const SERVER_ONLY_MARKER = 'sleekstack-showcase-server-only-9d7b3e12'

let seq = 0
const InfraLive = Layer.mergeAll(
  Layer.succeed(Clock, { now: () => Date.now() }),
  Layer.succeed(IdGen, { next: (prefix: string) => `${prefix}_${++seq}` }),
  Layer.effectDiscard(Effect.sync(() => console.log(SERVER_ONLY_MARKER, '[Infra] startup'))),
)

const ActivityLogLive = Layer.effect(
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

export const AppLive = Layer.mergeAll(BoardStoreLive, ActivityLogLive).pipe(
  Layer.provideMerge(InfraLive),
)
