/** @jsxImportSource @sleekstack/ui */
import { UserRepo, Viewer } from '../domain/ports'
import { Avatar } from './avatar'

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
