/** @jsxImportSource @sleekstack/ui */
import { Effect } from 'effect'
import { Boundary, useAtomValue, useEffect } from '@sleekstack/ui'
import { type Project, ProjectNotFound, ProjectRepo, projectAtom } from '../modules/projects'
import { ProjectBoard } from '../modules/tasks'

const APP_TITLE = 'SleekStack UI Demo'

/** The tab title while a project is on screen. It is a child of the view, so a failed project (the fallback replaces the view) removes it and its cleanup puts the plain title back. */
const DocumentTitle = function* ({ project }: { project: Project }) {
  yield* useEffect(() => {
    const title = `${project.name} · ${APP_TITLE}`
    document.title = title
    return () => {
      if (document.title === title) document.title = APP_TITLE
    }
  }, [project.id])
  return <></>
}

/** Needs ProjectRepo; reads the open project and fails with ProjectNotFound for an unknown or archived one. */
const ProjectView = function* () {
  const project = yield* Effect.flatMap(useAtomValue(projectAtom), ProjectRepo.get)
  return (
    <section className="board">
      <DocumentTitle project={project} />
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
