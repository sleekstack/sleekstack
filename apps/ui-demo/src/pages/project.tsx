/** @jsxImportSource @sleekstack/ui */
import { Effect } from 'effect'
import { Boundary, useAtomValue, useEffect } from '@sleekstack/ui'
import { ProjectNotFound, ProjectRepo, projectAtom } from '../modules/projects'
import { ProjectBoard } from '../modules/tasks'

const APP_TITLE = 'SleekStack UI Demo'

/** Needs ProjectRepo; reads the open project and fails with ProjectNotFound for an unknown or archived one. */
const ProjectView = function* () {
  const project = yield* Effect.flatMap(useAtomValue(projectAtom), ProjectRepo.get)
  // The tab title follows the open project; the cleanup puts the plain title back unless another project already took it.
  yield* useEffect(() => {
    const title = `${project.name} · ${APP_TITLE}`
    document.title = title
    return () => {
      if (document.title === title) document.title = APP_TITLE
    }
  }, [project.id])
  return (
    <section className="board">
      <h2>{project.name}</h2>
      <ProjectBoard projectId={project.id} />
    </section>
  )
}

/** The project on screen: `ProjectView` follows `projectAtom` itself. */
export const ProjectPage = () => (
  <Boundary tag="ProjectNotFound" fallback={(e: ProjectNotFound) => <p className="error">No project "{e.id}"</p>}>
    <ProjectView />
  </Boundary>
)
