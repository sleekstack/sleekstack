/** @jsxImportSource @sleekstack/ui */
import {
  loader,
  LoaderTransferLive,
  match,
  type Match,
  params,
  prefetchLoader,
  routeLayer,
  routes,
  useLoader,
} from '@sleekstack/router'
import { Pending, Provider, useLocal } from '@sleekstack/ui'
import { Effect, Option, Schema } from 'effect'
import { UserRepo } from '../modules/identity'

/** A `const` table of path strings: `params(table, 'person')` is typed `{ id: string }`. */
const table = routes({ person: '/people/:id' })
type PersonRoute = Match<typeof table>
const routeOf = (id: string): PersonRoute => Option.getOrThrow(match(table, `/people/${id}`))

/** A teammate, after a simulated round trip. The schema encodes the result for the client; an id from the list always exists. */
const person = loader(
  'person',
  Schema.Struct({ id: Schema.String, name: Schema.String, canEdit: Schema.Boolean }),
  Effect.flatMap(params(table, 'person'), ({ id }) => UserRepo.get(id).pipe(Effect.delay('300 millis'), Effect.orDie)),
)

const Profile = function* () {
  const user = yield* useLoader(person)
  return (
    <p className="profile">
      {user.name} {user.canEdit ? 'edits the board' : 'reads the board'}
    </p>
  )
}

/**
 * The anchor the router's `Link` renders, written out because `sleekstack check` cannot read `Link`'s declaration:
 * hovering or focusing it prefetches the route's loader, so a click shows the profile at once. A routed app follows
 * links with `startRouter`; inside the shell the click opens the route in place and the URL stays put.
 */
const PersonLink = ({ to, name, onOpen }: { to: PersonRoute; name: string; onOpen: (to: PersonRoute) => void }) => {
  const warm = prefetchLoader(person, to)
  return (
    <a
      href={to.pathname}
      onMouseEnter={warm}
      onFocus={warm}
      onClick={(e) => {
        e.preventDefault()
        onOpen(to)
      }}
    >
      {name}
    </a>
  )
}

/** The open route's page runs under `Pending`, keyed by its pathname, as the router renders a page. */
const People = function* () {
  const users = yield* UserRepo.all()
  const [route, setRoute] = yield* useLocal(routeOf('u1'))
  return (
    <>
      <nav className="row people">
        {users.map((u) => (
          <PersonLink key={u.id} to={routeOf(u.id)} name={u.name} onOpen={setRoute} />
        ))}
      </nav>
      <Provider layer={routeLayer(route)}>
        <Pending key={route.pathname} fallback={<p className="muted">Loading {route.pathname}</p>}>
          <Profile />
        </Pending>
      </Provider>
    </>
  )
}

/** `@sleekstack/router` inside the shell: the loader results live in this page's `LoaderTransferLive`. */
export const RouterDemo = () => (
  <section className="demo router">
    <h2>Router</h2>
    <Provider layer={LoaderTransferLive}>
      <People />
    </Provider>
  </section>
)
