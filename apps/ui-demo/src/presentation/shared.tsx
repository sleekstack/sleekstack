/** @jsxImportSource @sleekstack/ui */
import { Effect } from 'effect'
import { Boundary } from '@sleekstack/ui'
import type { UserNotFound } from '../domain/errors'
import type { Priority, Status } from '../domain/model'
import { UserRepo, Viewer } from '../domain/ports'
import { Avatar } from './guests'

export const STATUS_LABEL: Record<Status, string> = { todo: 'To do', in_progress: 'In progress', done: 'Done' }

export const StatusBadge = ({ status }: { status: Status }) => (
  <span className={`badge ${status}`}>{STATUS_LABEL[status]}</span>
)
export const PriorityBadge = ({ priority }: { priority: Priority }) => (
  <span className={`priority ${priority}`}>{priority}</span>
)

/** Needs UserRepo and Viewer; fails with UserNotFound. */
export const Assignee = ({ id }: { id: string }) =>
  Effect.gen(function* () {
    const user = yield* UserRepo.get(id)
    const { user: viewer } = yield* Viewer
    return yield* (
      <>
        <Avatar name={user.name} />
        <span>{user.name}</span>
        {viewer.id === user.id && <em className="you">you</em>}
      </>
    )
  })

export const MaybeAssignee = ({ id }: { id: string | null }) => (
  <Boundary tag="UserNotFound" fallback={(_: UserNotFound) => <span className="muted">Left the team</span>}>
    {id ? <Assignee id={id} /> : <span className="muted">Unassigned</span>}
  </Boundary>
)
