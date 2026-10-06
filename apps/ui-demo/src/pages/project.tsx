/** @jsxImportSource @sleekstack/ui */
import { Boundary, useAtomValue, useEffect } from '@sleekstack/ui'
import { ProjectNotFound, ProjectRepo, projectAtom } from '../modules/projects'
import { ProjectBoard } from '../modules/tasks'

const APP_TITLE = 'SleekStack UI Demo'

/** Needs ProjectRepo; fails with ProjectNotFound for an unknown or archived project. */
const ProjectView = function* ({ projectId }: { projectId: string }) {
  const project = yield* ProjectRepo.get(projectId)
  // The tab title follows the open project; put back when it closes unless another project already took it.
  yield* useEffect(() => {
    const title = `${project.name} · ${APP_TITLE}`
    document.title = title
    return () => {
      if (document.title === title) document.title = APP_TITLE
    }
  }, [project.name])
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
