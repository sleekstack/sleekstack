/** @jsxImportSource @sleekstack/ui */
import { Effect } from 'effect'
import { useAtomValue, useSetAtom } from '@sleekstack/ui'
import { filterAtom, projectAtom, selectedAtom } from '../application/state'
import { TaskRepo, UserRepo, Viewer } from '../domain/ports'
import { Avatar } from './guests'

/** Project ids saved in the nav; `p0` was archived since. */
const BOOKMARKS: ReadonlyArray<string> = ['p1', 'p2', 'p0']

/** Saved project links. Opening one clears the open task and the status filter. */
export const ProjectNav = function* () {
  const known = yield* TaskRepo.projects()
  const current = yield* useAtomValue(projectAtom)
  const setProject = yield* useSetAtom(projectAtom)
  const select = yield* useSetAtom(selectedAtom)
  const setFilter = yield* useSetAtom(filterAtom)
  const open = (id: string) =>
    Effect.sync(() => {
      setProject(id)
      select(null)
      setFilter('all')
    })
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

export const Team = function* () {
  const users = yield* UserRepo.all()
  return (
    <ul className="team">
      {users.map((u) => (
        <li key={u.id}>
          <Avatar name={u.name} /> {u.name}
        </li>
      ))}
    </ul>
  )
}

export const Header = function* () {
  const { user: viewer } = yield* Viewer
  return (
    <header>
      <h1>SleekStack board</h1>
      <Avatar name={viewer.name} />
    </header>
  )
}
