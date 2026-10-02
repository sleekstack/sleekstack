/**
 * apps/showcase/src/infrastructure/app.ts
 *
 * The composition root: Infra (Clock, IdGen) -> BoardStore + ActivityLog. `AppLive` is what the
 * server ManagedRuntime builds once; only delivery/runtime.server.ts imports it.
 */
import 'server-only'
import { Layer } from 'effect'
import { BoardStoreLive } from './board-store.memory'
import { ActivityLogLive, InfraLive } from './runtime-infra.live'

export const AppLive = Layer.mergeAll(BoardStoreLive, ActivityLogLive).pipe(Layer.provideMerge(InfraLive))
