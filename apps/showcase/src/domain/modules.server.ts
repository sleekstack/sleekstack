/**
 * apps/showcase/src/domain/modules.server.ts
 *
 * Assembles the domain graph (R1): Infra -> Data -> Activity -> App.
 * - Infra: Clock, Logger, IdGen (`service()`) plus one self-contained bare
 *   Layer (the graph's opaque node).
 * - Data: Store (private — not in `exports`, the graph's one private node)
 *   plus the three repos, importing Infra directly.
 * - Activity: ActivityLog via `declareLayer` (the graph's one declared
 *   node), importing Infra for Clock.
 * - App: imports Data and Activity through a thunk (forward-reference style
 *   import, demonstrating the lazy `Imports` form) and re-exports everything
 *   downstream code needs.
 *
 * `appEntries` is what `/graph` and `/errors` (and the test suite) build.
 */
import 'server-only'
import { module } from '@sleekstack/core'
import { ActivityLogDecl } from './activity.server'
import { ClockDef, IdGenDef, InfraStartupLayer, LoggerDef } from './infra.server'
import { CommentRepoDef, ProjectRepoDef, TaskRepoDef } from './repos.server'
import { StoreDef } from './store.server'
import { ActivityLog, Clock, CommentRepo, IdGen, Logger, ProjectRepo, TaskRepo } from './tags'

export const SERVER_ONLY_MARKER = 'sleekstack-showcase-server-only-9d7b3e12'

export const InfraModule = module({
  name: 'Infra',
  entries: [ClockDef, LoggerDef, IdGenDef, InfraStartupLayer],
  exports: [Clock, Logger, IdGen],
})

export const DataModule = module({
  name: 'Data',
  imports: [InfraModule],
  entries: [StoreDef, ProjectRepoDef, TaskRepoDef, CommentRepoDef],
  // Store is deliberately left out: it's private to this module (R2's privacy flag).
  exports: [ProjectRepo, TaskRepo, CommentRepo],
})

export const ActivityModule = module({
  name: 'Activity',
  imports: [InfraModule],
  entries: [ActivityLogDecl],
  exports: [ActivityLog],
})

export const AppModule = module({
  name: 'App',
  // Forward-reference thunk (R1): resolved lazily rather than as a plain array.
  imports: () => [DataModule, ActivityModule],
  exports: [ProjectRepo, TaskRepo, CommentRepo, ActivityLog, Clock, Logger, IdGen],
})

export const appEntries = [AppModule]
