/** @jsxImportSource @sleekstack/ui */
import { Effect } from 'effect'
import { useAtomValue, useSetAtom } from '@sleekstack/ui'
import { projectAtom } from '../application/state'
import { ProjectRepo } from '../domain/ports'

/** Project ids saved in the nav; `p0` was archived since. */
const BOOKMARKS: ReadonlyArray<string> = ['p1', 'p2', 'p0']

/** Saved project links. `onOpen` is run after the project changes (to reset state the caller owns). */
export const ProjectNav = function* ({ onOpen }: { onOpen?: Effect.Effect<void> }) {
  const known = yield* ProjectRepo.all()
  const current = yield* useAtomValue(projectAtom)
  const setProject = yield* useSetAtom(projectAtom)
  const open = (id: string) =>
    Effect.zipRight(
      Effect.sync(() => setProject(id)),
      onOpen ?? Effect.void,
    )
  return (
    <nav className="projects">
      {BOOKMARKS.map((id) => (
        <button
          key={id}
          type="button"
          className={id === current ? 'project current' : 'project'}
          data-project={id}
          onClick={() => open(id)}
        >
          {known.find((p) => p.id === id)?.name ?? 'Old roadmap'}
        </button>
      ))}
    </nav>
  )
}
