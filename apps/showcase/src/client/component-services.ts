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
 * comment-draft atom. Both are plain scoped Layers that acquire
 * asynchronously (`Effect.sleep`) and log to `scopeLog` on acquire/release
 * (stamped with Effect's built-in `Clock`), so R6/R7/R8's ordering and StrictMode-dedup assertions have something real
 * to observe. `makeBrokenDraftEditorLayer` is the "break detail" control's
 * failing variant (R7's error-boundary case).
 */
import { Atom } from '@sleekstack/core'
import { Clock, Context, Effect, Layer } from 'effect'
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

const log = (message: string) => Effect.map(Clock.currentTimeMillis, (at) => scopeLog.record(`${message} at ${at}`))

export const makeProjectFilterStoreLayer = (projectId: string) =>
  Layer.scoped(
    ProjectFilterStore,
    Effect.acquireRelease(
      Effect.gen(function* () {
        yield* Effect.sleep(10)
        yield* log(`acquire: ProjectFilterStore (${projectId})`)
        const selectedTaskId = createStore(selectionMemory.get(projectId) ?? null)
        selectedTaskId.subscribe(() => selectionMemory.set(projectId, selectedTaskId.get()))
        const service: ProjectFilterStoreService = { filter: createStore('all'), selectedTaskId }
        return service
      }),
      () => log(`release: ProjectFilterStore (${projectId})`),
    ),
  )

export interface DraftEditorService {
  /** The comment-draft atom; its state lives (and dies) with the task-detail provider's atom store. */
  readonly draft: Atom.Writable<string>
}

export const DraftEditor = Context.GenericTag<DraftEditorService>('DraftEditor')

export const makeDraftEditorLayer = (taskId: string) =>
  Layer.scoped(
    DraftEditor,
    Effect.acquireRelease(
      Effect.gen(function* () {
        yield* Effect.sleep(10)
        yield* log(`acquire: DraftEditor (${taskId})`)
        const service: DraftEditorService = { draft: Atom.make('') }
        return service
      }),
      () => log(`release: DraftEditor (${taskId})`),
    ),
  )

/** The "break detail" control's variant: acquisition fails, so `useService` throws to the ErrorBoundary. */
export const makeBrokenDraftEditorLayer = (taskId: string) =>
  Layer.effect(
    DraftEditor,
    Effect.sleep(10).pipe(Effect.andThen(() => Effect.fail(new Error(`DraftEditor acquisition failed for task ${taskId} (simulated)`)))),
  )
