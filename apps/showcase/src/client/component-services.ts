/**
 * apps/showcase/src/client/component-services.ts
 *
 * Client-safe component-scoped service definitions (R7): no `server-only`
 * or `next/headers` import here, only `effect` and the tags-only domain
 * module, so this file is safe for the client bundle (R10).
 *
 * `ProjectFilterStore` (project scope) owns the project's filter and
 * selected-task state (a reactive `ReactiveStore`, read with
 * `useSyncExternalStore`); `DraftEditor` (task-detail scope) owns the
 * comment-draft buffer. Both acquire asynchronously (`Effect.sleep`),
 * requiring `Clock` from their environment (R9: shadowed client-side by
 * `providers.tsx`'s root `LayerProvider`, mirroring `demo.server.ts`'s
 * server-side `MockClockDef`), and log to `scopeLog` on acquire/release, so
 * R6/R7/R8's ordering and StrictMode-dedup assertions have something real
 * to observe. `makeBrokenDraftEditorLayer` is the "break detail" control's
 * failing variant (R7's error-boundary case).
 */
import { declareLayer } from '@sleekstack/core'
import { Context, Effect, Layer } from 'effect'
import { Clock, type ClockService } from '../domain/tags'
import { scopeLog } from './ScopeLog'

/** A minimal external store (`useSyncExternalStore`-compatible) for state a component service owns across its scope's lifetime. */
export interface ReactiveStore<T> {
  get(): T
  set(value: T): void
  subscribe(listener: () => void): () => void
}

function createStore<T>(initial: T): ReactiveStore<T> {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set: (next) => {
      value = next
      listeners.forEach((listen) => listen())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

// R9: the client-side shadowing pair for Clock — the real client bundle never
// imports `demo.server.ts` (R10), so this is its own client-safe Layer,
// selected by `providers.tsx` from the same `isDemoMode()` value the server
// read (no separate override API).
export const RealClientClockLayer = Layer.succeed(Clock, { now: () => Date.now() })
export const MockClientClockLayer = Layer.succeed(Clock, { now: () => 0 })

export type TaskStatusFilter = 'all' | 'todo' | 'in_progress' | 'done'

export interface ProjectFilterStoreService {
  readonly filter: ReactiveStore<TaskStatusFilter>
  readonly selectedTaskId: ReactiveStore<string | null>
}

/**
 * R9: each project's selected task id, kept at module scope (outside the
 * scoped service) so the demo toggle's root remount reopens — remounts, not
 * closes — an open task detail in the new scope.
 */
export const selectionMemory = new Map<string, string | null>()

export const ProjectFilterStore = Context.GenericTag<ProjectFilterStoreService>('ProjectFilterStore')

const logWithClock = (clock: ClockService, message: string) => scopeLog.record(`${message} at ${clock.now()}`)

export const makeProjectFilterStoreLayer = (projectId: string) =>
  // Requires Clock (R9's client shadowing target) from the ambient app-level
  // scope, so it can't be a bare Layer (`requires: never` — packages/core/src/module.ts);
  // `declareLayer` records the real requirement for the graph to check.
  declareLayer(
    Layer.scoped(
      ProjectFilterStore,
      Effect.acquireRelease(
        Effect.gen(function* () {
          const clock = yield* Clock
          yield* Effect.sleep(10)
          logWithClock(clock, `acquire: ProjectFilterStore (${projectId})`)
          const selectedTaskId = createStore(selectionMemory.get(projectId) ?? null)
          selectedTaskId.subscribe(() => selectionMemory.set(projectId, selectedTaskId.get()))
          const service: ProjectFilterStoreService = { filter: createStore('all'), selectedTaskId }
          return service
        }),
        () =>
          Effect.gen(function* () {
            const clock = yield* Clock
            logWithClock(clock, `release: ProjectFilterStore (${projectId})`)
          }),
      ),
    ),
    { provides: [ProjectFilterStore], requires: [Clock] },
  )

export interface DraftEditorService {
  /** The comment-draft buffer: lives (and dies) with the task-detail scope. */
  readonly draft: ReactiveStore<string>
}

export const DraftEditor = Context.GenericTag<DraftEditorService>('DraftEditor')

export const makeDraftEditorLayer = (taskId: string) =>
  declareLayer(
    Layer.scoped(
      DraftEditor,
      Effect.acquireRelease(
        Effect.gen(function* () {
          const clock = yield* Clock
          yield* Effect.sleep(10)
          logWithClock(clock, `acquire: DraftEditor (${taskId})`)
          const service: DraftEditorService = { draft: createStore('') }
          return service
        }),
        () =>
          Effect.gen(function* () {
            const clock = yield* Clock
            logWithClock(clock, `release: DraftEditor (${taskId})`)
          }),
      ),
    ),
    { provides: [DraftEditor], requires: [Clock] },
  )

/** The "break detail" control's variant: acquisition fails, so `useService` throws to the ErrorBoundary. */
export const makeBrokenDraftEditorLayer = (taskId: string) =>
  Layer.effect(
    DraftEditor,
    Effect.sleep(10).pipe(Effect.andThen(() => Effect.fail(new Error(`DraftEditor acquisition failed for task ${taskId} (simulated)`)))),
  )
