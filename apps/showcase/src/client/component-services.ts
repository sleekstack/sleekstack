/**
 * apps/showcase/src/client/component-services.ts
 *
 * Client-safe component-scoped service definitions (R7): no `server-only`
 * or `next/headers` import here, only `effect` and the tags-only domain
 * module, so this file is safe for the client bundle (R10).
 *
 * `ProjectFilterStore` (project scope) and `DraftEditor` (task-detail scope)
 * both acquire asynchronously (`Effect.sleep`) and log to `scopeLog` on
 * acquire/release, so R6/R7/R8's ordering and StrictMode-dedup assertions
 * have something real to observe. `makeBrokenDraftEditorLayer` is the
 * "break detail" control's failing variant (R7's error-boundary case).
 */
import { Context, Effect, Layer } from 'effect'
import { scopeLog } from './ScopeLog'

export type TaskStatusFilter = 'all' | 'todo' | 'in_progress' | 'done'

export interface ProjectFilterStoreService {
  readonly defaultFilter: TaskStatusFilter
}

export const ProjectFilterStore = Context.GenericTag<ProjectFilterStoreService>('ProjectFilterStore')

export const makeProjectFilterStoreLayer = (projectId: string) =>
  Layer.scoped(
    ProjectFilterStore,
    Effect.acquireRelease(
      Effect.sleep(10).pipe(
        Effect.andThen(() => Effect.sync(() => scopeLog.record(`acquire: ProjectFilterStore (${projectId})`))),
        Effect.as<ProjectFilterStoreService>({ defaultFilter: 'all' }),
      ),
      () => Effect.sync(() => scopeLog.record(`release: ProjectFilterStore (${projectId})`)),
    ),
  )

export interface DraftEditorService {
  readonly draft: string
}

export const DraftEditor = Context.GenericTag<DraftEditorService>('DraftEditor')

export const makeDraftEditorLayer = (taskId: string) =>
  Layer.scoped(
    DraftEditor,
    Effect.acquireRelease(
      Effect.sleep(10).pipe(
        Effect.andThen(() => Effect.sync(() => scopeLog.record(`acquire: DraftEditor (${taskId})`))),
        Effect.as<DraftEditorService>({ draft: '' }),
      ),
      () => Effect.sync(() => scopeLog.record(`release: DraftEditor (${taskId})`)),
    ),
  )

/** The "break detail" control's variant: acquisition fails, so `useService` throws to the ErrorBoundary. */
export const makeBrokenDraftEditorLayer = (taskId: string) =>
  Layer.effect(
    DraftEditor,
    Effect.sleep(10).pipe(Effect.andThen(() => Effect.fail(new Error(`DraftEditor acquisition failed for task ${taskId} (simulated)`)))),
  )
