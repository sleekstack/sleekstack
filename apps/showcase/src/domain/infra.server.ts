/**
 * apps/showcase/src/domain/infra.server.ts
 *
 * Infra module's implementations (R1): Clock, Logger, IdGen as `service()`
 * definitions, plus a self-contained bare Layer (requirement type `never`) —
 * the graph's one opaque node — that just announces startup. Server-only
 * (pattern: apps/playground/src/services.server.ts).
 */
import 'server-only'
import { service, type BareLayer } from '@sleekstack/core'
import { Effect, Layer } from 'effect'
import { Clock, IdGen, Logger } from './tags'

export const SERVER_ONLY_MARKER = 'sleekstack-showcase-server-only-9d7b3e12'

export const ClockDef = service(Clock, {}, () => Effect.succeed({ now: () => Date.now() }))

export const LoggerDef = service(Logger, {}, () =>
  Effect.succeed({ log: (message: string) => console.log('[showcase]', message) }),
)

let seq = 0
export const IdGenDef = service(IdGen, {}, () =>
  Effect.succeed({ next: (prefix: string) => `${prefix}_${++seq}` }),
)

/** Self-contained bare Layer: the graph's one opaque node (provides nothing, requires nothing). */
export const InfraStartupLayer = Layer.effectDiscard(
  Effect.sync(() => console.log(SERVER_ONLY_MARKER, '[Infra] startup')),
) as unknown as BareLayer
