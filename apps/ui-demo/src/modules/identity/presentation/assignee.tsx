/** @jsxImportSource @sleekstack/ui */
import { Boundary } from '@sleekstack/ui'
import type { UserNotFound } from '../domain/errors'
import { UserRepo, Viewer } from '../domain/ports'
import { Avatar } from './avatar'

/** Needs UserRepo and Viewer; fails with UserNotFound. */
export const Assignee = function* ({ id }: { id: string }) {
  const user = yield* UserRepo.get(id)
  const { user: viewer } = yield* Viewer
  return (
    <>
      <Avatar name={user.name} />
      <span>{user.name}</span>
      {viewer.id === user.id && <em className="you">you</em>}
    </>
  )
}

export const MaybeAssignee = ({ id }: { id: string | null }) => (
  <Boundary tag="UserNotFound" fallback={(_: UserNotFound) => <span className="muted">Left the team</span>}>
    {id ? <Assignee id={id} /> : <span className="muted">Unassigned</span>}
  </Boundary>
)
