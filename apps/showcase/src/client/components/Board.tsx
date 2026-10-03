'use client'
/**
 * apps/showcase/src/client/components/Board.tsx
 *
 * R7: the interactive board, rendered inside `providers.tsx`'s app-level
 * `LayerProvider`. It reads the `board` query (prefetched by the page and
 * hydrated by `<HydrateQueries>`) and turns the cached DTO into Models with
 * `BoardModel.fromDto`, once per data change. One `ProjectView` per project —
 * the project's own `ProjectFilterStore` component service owns its filter
 * and (if any) open task-detail selection.
 */
import { useMemo } from 'react'
import { Effect } from 'effect'
import { useQuery } from '@sleekstack/react'
import { BoardModel, type BoardProject } from '../../models/task'
import { board as boardQuery } from '../services/board-query'
import { DemoToggle } from './DemoToggle'
import { ProjectView } from './ProjectView'
import { ScopeLog } from './ScopeLog'

export type { BoardProject }

export function Board({ demoMode }: { readonly demoMode: boolean }) {
  const { data } = useQuery(boardQuery())
  const board = useMemo(() => (data ? Effect.runSync(BoardModel.fromDto(data)) : undefined), [data])

  return (
    <div>
      <DemoToggle demoMode={demoMode} />
      {board ? board.map(({ project, tasks }) => <ProjectView key={project.id} project={project} tasks={tasks} />) : <p>Loading board…</p>}
      <ScopeLog />
    </div>
  )
}
