/** @jsxImportSource @sleekstack/ui */
import { Effect, Option } from 'effect'
import { Boundary, useAtomValue, useEffect } from '@sleekstack/ui'
import { ProjectNotFound, ProjectRepo, projectAtom } from '../modules/projects'
import { ProjectBoard } from '../modules/tasks'

const APP_TITLE = 'SleekStack UI Demo'

/** Needs ProjectRepo; reads the open project and fails with ProjectNotFound for an unknown or archived one. */
const ProjectView = function* () {
  const projectId = yield* useAtomValue(projectAtom)
  const project = yield* ProjectRepo.get(projectId)
  // The tab title follows the open project. The effect reads `projectAtom` itself, so it re-runs (finalizer first) when
  // the project changes; the finalizer puts the plain title back unless another project already took it.
  yield* useEffect(function* () {
    const id = yield* useAtomValue(projectAtom)
    const found = yield* Effect.option(ProjectRepo.get(id))
    if (Option.isNone(found)) return
    const title = `${found.value.name} · ${APP_TITLE}`
    document.title = title
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        if (document.title === title) document.title = APP_TITLE
      }),
    )
  })
  return (
    <section className="board">
      <h2>{project.name}</h2>
      <ProjectBoard projectId={projectId} />
    </section>
  )
}

/** The project on screen: `ProjectView` follows `projectAtom` itself. */
export const ProjectPage = () => (
  <Boundary tag="ProjectNotFound" fallback={(e: ProjectNotFound) => <p className="error">No project "{e.id}"</p>}>
    <ProjectView />
  </Boundary>
)
