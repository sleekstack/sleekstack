/**
 * apps/showcase/src/infrastructure/app.ts
 *
 * The composition root: Infra (Clock, IdGen) -> BoardStore + ActivityLog. `AppLive` is what the
 * server ManagedRuntime builds once; only delivery/runtime.server.ts imports it,
 * and takes the request and demo-override Layers from here too.
 */
import 'server-only'
import { Layer } from 'effect'
import { BoardStoreLive } from './board-store.memory'
import { ActivityLogLive, InfraLive } from './runtime-infra.live'

export { DemoLive } from './demo.live'
export { RequestLive } from './request.live'

export const AppLive = Layer.mergeAll(BoardStoreLive, ActivityLogLive).pipe(Layer.provideMerge(InfraLive))
