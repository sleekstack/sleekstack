/** @jsxImportSource @sleekstack/ui */
import { Effect } from 'effect'
import { Boundary, useAtomValue, useMount } from '@sleekstack/ui'
import { ProjectNotFound, ProjectRepo, projectAtom } from '../modules/projects'
import { ProjectBoard } from '../modules/tasks'

const APP_TITLE = 'SleekStack UI Demo'

/** The tab title while a project is open; put back when it closes unless another project already took it. */
const titled = (name: string) => {
  const title = `${name} · ${APP_TITLE}`
  return Effect.acquireRelease(
    Effect.sync(() => void (document.title = title)),
    () => Effect.sync(() => void (document.title === title && (document.title = APP_TITLE))),
  )
}

/** Needs ProjectRepo; fails with ProjectNotFound for an unknown or archived project. */
const ProjectView = function* ({ projectId }: { projectId: string }) {
  const project = yield* ProjectRepo.get(projectId)
  yield* useMount(titled(project.name))
  return (
    <section className="board">
      <h2>{project.name}</h2>
      <ProjectBoard projectId={projectId} />
    </section>
  )
}

/** The project on screen; re-runs when it changes. */
export const ProjectPage = function* () {
  const projectId = yield* useAtomValue(projectAtom)
  return (
    <Boundary tag="ProjectNotFound" fallback={(e: ProjectNotFound) => <p className="error">No project "{e.id}"</p>}>
      <ProjectView key={projectId} projectId={projectId} />
    </Boundary>
  )
}
