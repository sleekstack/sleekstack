'use client'
/**
 * apps/showcase-kit/src/client/Board.tsx
 *
 * R7: the interactive board, rendered inside `providers.tsx`'s app-level
 * `LayerProvider`. One `ProjectView` per project — the project's own
 * `ProjectFilterStore` component service owns its filter and (if any)
 * open task-detail selection.
 */
import type { CommentRecord, ProjectRecord, TaskRecord } from '../domain/tags'
import { DemoToggle } from './DemoToggle'
import { ProjectView } from './ProjectView'
import { ScopeLog } from './ScopeLog'

export interface BoardProject {
  readonly project: ProjectRecord
  readonly tasks: ReadonlyArray<{ readonly task: TaskRecord; readonly comments: readonly CommentRecord[] }>
}

export function Board({ board, demoMode }: { readonly board: readonly BoardProject[]; readonly demoMode: boolean }) {
  return (
    <div>
      <DemoToggle demoMode={demoMode} />
      {board.map(({ project, tasks }) => (
        <ProjectView key={project.id} project={project} tasks={tasks} />
      ))}
      <ScopeLog />
    </div>
  )
}
