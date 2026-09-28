/**
 * apps/showcase-kit/src/client/component-services.ts
 *
 * Client-safe component-lifetime services: `ProjectFilterStore` (project
 * scope: filter + selected task) and `DraftEditor` (task-detail scope: the
 * comment draft). Both acquire asynchronously, need `Clock` from the app-level
 * provider (real or mock, the client half of demo Shadowing), and log to
 * `scopeLog` on acquire/release. `makeBrokenDraftEditorLayer` is the
 * "break detail" failing variant.
 */
import { layer, tag, withCleanup } from '@sleekstack/kit'
import { Clock, type ClockService } from '../domain/tags'
import { scopeLog } from './ScopeLog'

/** A minimal `useSyncExternalStore`-compatible store for state a component service owns. */
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const RealClientClockLayer = layer(Clock, { now: () => Date.now() })
export const MockClientClockLayer = layer(Clock, { now: () => 0 })

export type TaskStatusFilter = 'all' | 'todo' | 'in_progress' | 'done'

export interface ProjectFilterStoreService {
  readonly filter: ReactiveStore<TaskStatusFilter>
  readonly selectedTaskId: ReactiveStore<string | null>
}

/** Each project's selected task id, outside the scope, so a demo remount reopens an open detail. */
export const selectionMemory = new Map<string, string | null>()

export const ProjectFilterStore = tag<ProjectFilterStoreService>('ProjectFilterStore')

const logWithClock = (clock: ClockService, message: string) => scopeLog.record(`${message} at ${clock.now()}`)

export const makeProjectFilterStoreLayer = (projectId: string) =>
  layer(ProjectFilterStore, async (clock) => {
    await sleep(10)
    logWithClock(clock, `acquire: ProjectFilterStore (${projectId})`)
    const selectedTaskId = createStore(selectionMemory.get(projectId) ?? null)
    selectedTaskId.subscribe(() => selectionMemory.set(projectId, selectedTaskId.get()))
    const service: ProjectFilterStoreService = { filter: createStore<TaskStatusFilter>('all'), selectedTaskId }
    return withCleanup(service, () => logWithClock(clock, `release: ProjectFilterStore (${projectId})`))
  }, [Clock], { lifetime: 'component' })

export interface DraftEditorService {
  /** The comment-draft buffer: lives (and dies) with the task-detail scope. */
  readonly draft: ReactiveStore<string>
}

export const DraftEditor = tag<DraftEditorService>('DraftEditor')

export const makeDraftEditorLayer = (taskId: string) =>
  layer(DraftEditor, async (clock) => {
    await sleep(10)
    logWithClock(clock, `acquire: DraftEditor (${taskId})`)
    return withCleanup({ draft: createStore('') }, () => logWithClock(clock, `release: DraftEditor (${taskId})`))
  }, [Clock], { lifetime: 'component' })

/** "Break detail": acquisition rejects, so `useService` throws to the ErrorBoundary. */
export const makeBrokenDraftEditorLayer = (taskId: string) =>
  layer(DraftEditor, async (): Promise<DraftEditorService> => {
    await sleep(10)
    throw new Error(`DraftEditor acquisition failed for task ${taskId} (simulated)`)
  }, [], { lifetime: 'component' })
