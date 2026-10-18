/** @jsxImportSource @sleekstack/ui */
import { createElement } from 'react'
import { Context, Data, Effect, Layer } from 'effect'
import { Boundary, fromReact, mount, Provider } from '@sleekstack/ui'

class UserNotFound extends Data.TaggedError('UserNotFound')<{ readonly id: string }> {}
class Users extends Context.Tag('Users')<Users, { name(id: string): Effect.Effect<string, UserNotFound> }>() {}

// A generator component yields Effects and returns its element.
// Its requirement (`Users`) and error (`UserNotFound`) come from what it yields.
const UserName = function* ({ id }: { id: string }) {
  const users = yield* Users
  const name = yield* users.name(id)
  return <strong>{name}</strong>
}

// A plain React component as a guest leaf: React renders it with its props and no services.
const Badge = fromReact(({ label }: { label: string }) => createElement('span', { className: 'badge' }, label))

// A function of props that returns JSX is a component too.
const Card = ({ id, role }: { id: string; role: string }) => (
  <article class="card">
    <Boundary tag="UserNotFound" fallback={(e: UserNotFound) => <p>No user {e.id}</p>}>
      <UserName id={id} />
    </Boundary>
    <Badge label={role} />
  </article>
)

const UsersLive = Layer.succeed(Users, {
  name: (id) => (id === 'u1' ? Effect.succeed('Ada') : Effect.fail(new UserNotFound({ id }))),
})

// `Provider` supplies `Users` below it, so the mount layer has nothing left to provide.
export const start = (container: Element) =>
  mount(
    <Provider layer={UsersLive}>
      <Card id="u1" role="editor" />
      <Card id="u2" role="viewer" />
    </Provider>,
    { layer: Layer.empty, container },
  )
