'use client'
/**
 * apps/showcase-kit/src/client/Board.tsx
 *
 * R7: the interactive board, rendered inside `providers.tsx`'s app-level
 * `LayerProvider`. It reads the `board` query (board-family.ts). The kit has
 * no server prefetch, so the server render and hydration show a placeholder
 * and the client fetches. One `ProjectView` per project — the
 * project's own `ProjectFilterStore` component service owns its filter and
 * (if any) open task-detail selection.
 */
import { useSyncExternalStore } from 'react'
import { useQuery } from '@sleekstack/kit/react'
import { board as boardQuery, type BoardProject } from './board-family'
import { DemoToggle } from './DemoToggle'
import { ProjectView } from './ProjectView'
import { ScopeLog } from './ScopeLog'

export type { BoardProject }

const noSubscribe = () => () => {}

function Projects() {
  const { data, error } = useQuery(boardQuery())
  if (error) return <p role="alert">{error.message}</p>
  if (!data) return <p>Loading board…</p>
  return data.map(({ project, tasks }) => <ProjectView key={project.id} project={project} tasks={tasks} />)
}

export function Board({ demoMode }: { readonly demoMode: boolean }) {
  // false on the server and while hydrating, true after: the board is fetched on the client only
  const client = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  )
  return (
    <div>
      <DemoToggle demoMode={demoMode} />
      {client ? <Projects /> : <p>Loading board…</p>}
      <ScopeLog />
    </div>
  )
}
