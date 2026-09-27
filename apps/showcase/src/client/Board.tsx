'use client'
/**
 * apps/showcase/src/client/Board.tsx
 *
 * R7: the interactive board, rendered inside `providers.tsx`'s app-level
 * `LayerProvider`. One `ProjectView` (and its own component scope) per
 * project; each independently tracks which task detail (if any) is open.
 */
import { useState } from 'react'
import type { CommentRecord, ProjectRecord, TaskRecord } from '../domain/tags'
import { DemoToggle } from './DemoToggle'
import { ProjectView } from './ProjectView'
import { ScopeLog } from './ScopeLog'

export interface BoardProject {
  readonly project: ProjectRecord
  readonly tasks: ReadonlyArray<{ readonly task: TaskRecord; readonly comments: readonly CommentRecord[] }>
}

export function Board({ board, demoMode }: { readonly board: readonly BoardProject[]; readonly demoMode: boolean }) {
  const [selectedByProject, setSelectedByProject] = useState<Readonly<Record<string, string | null>>>({})

  return (
    <div>
      <DemoToggle demoMode={demoMode} />
      {board.map(({ project, tasks }) => (
        <ProjectView
          key={project.id}
          project={project}
          tasks={tasks}
          selectedTaskId={selectedByProject[project.id] ?? null}
          onSelectTask={(taskId) => setSelectedByProject((prev) => ({ ...prev, [project.id]: taskId }))}
        />
      ))}
      <ScopeLog />
    </div>
  )
}
