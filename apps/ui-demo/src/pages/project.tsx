/** @jsxImportSource @sleekstack/ui */
import { Effect, Option } from 'effect'
import { Boundary, useAtomValue, useEffect } from '@sleekstack/ui'
import { ProjectNotFound, ProjectRepo, projectAtom } from '../modules/projects'
import { ProjectBoard } from '../modules/tasks'

const APP_TITLE = 'SleekStack UI Demo'

/** The project `projectAtom` names; fails with ProjectNotFound for an unknown or archived one. */
const useOpenProject = () => Effect.flatMap(useAtomValue(projectAtom), ProjectRepo.get)

/** Needs ProjectRepo. */
const ProjectView = function* () {
  const project = yield* useOpenProject()
  // The tab title follows the open project. The effect reads the same atom, so it re-runs (finalizer first) when the
  // project changes; the finalizer puts the plain title back unless another project already took it.
  yield* useEffect(function* () {
    const open = yield* Effect.option(useOpenProject())
    if (Option.isNone(open)) return
    const title = `${open.value.name} · ${APP_TITLE}`
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
