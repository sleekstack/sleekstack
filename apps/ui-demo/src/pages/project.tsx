/** @jsxImportSource @sleekstack/ui */
import { Result } from '@sleekstack/core'
import { Effect } from 'effect'
import { Boundary, useAtomValue, useDerivedAtom, useEffect } from '@sleekstack/ui'
import { ProjectNotFound, ProjectRepo, projectAtom } from '../modules/projects'
import { ProjectBoard } from '../modules/tasks'

const APP_TITLE = 'SleekStack UI Demo'

/** Needs ProjectRepo; shows the project `projectAtom` names, and fails with ProjectNotFound for an unknown or archived one. */
const ProjectView = function* () {
  // One derived atom, in the component's context (so it can use ProjectRepo); the view and the title effect both read it.
  const open = yield* useDerivedAtom(function* (get) {
    return yield* ProjectRepo.get(get(projectAtom))
  })
  const project = yield* useAtomValue(open)
  // The tab title follows the open project: the effect reads `open`, so it restarts (finalizer first) when it changes.
  yield* useEffect(function* () {
    const current = yield* useAtomValue(open)
    if (!Result.isSuccess(current)) return
    const title = `${current.value.name} · ${APP_TITLE}`
    document.title = title
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        if (document.title === title) document.title = APP_TITLE
      }),
    )
  })
  if (Result.isFailure(project)) return yield* Effect.failCause(project.cause)
  if (!Result.isSuccess(project)) return <p className="muted">Loading…</p>
  return (
    <section className="board">
      <h2>{project.value.name}</h2>
      <ProjectBoard projectId={project.value.id} />
    </section>
  )
}

/** The project on screen: `ProjectView` follows `projectAtom` itself. */
export const ProjectPage = () => (
  <Boundary tag="ProjectNotFound" fallback={(e: ProjectNotFound) => <p className="error">No project "{e.id}"</p>}>
    <ProjectView />
  </Boundary>
)
