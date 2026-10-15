/** @jsxImportSource @sleekstack/ui */
import { Link, loader, params, router, routes, startRouter, useLoader } from '@sleekstack/router'
import { useEffect, useRef } from '@sleekstack/ui'
import { Effect, Layer, Schema } from 'effect'
import { UserRepo } from '../modules/identity'

/** A `const` table of path strings: `params(table, 'person')` is typed `{ id: string }`. */
const table = routes({ team: '/', person: '/people/:id' })

/** A teammate, after a simulated round trip. The schema encodes the result for the client; an id from the list always exists. */
const person = loader(
  'person',
  Schema.Struct({ id: Schema.String, name: Schema.String, canEdit: Schema.Boolean }),
  Effect.flatMap(params(table, 'person'), ({ id }) => UserRepo.get(id).pipe(Effect.delay('300 millis'), Effect.orDie)),
)

/** Each name is a `Link`: hovering or focusing it prefetches the person's loader, so its click shows the page at once. */
const TeamNav = function* () {
  const users = yield* UserRepo.all()
  return (
    <nav className="row people">
      {users.map((u) => (
        <Link key={u.id} href={`/people/${u.id}`} table={table} loaders={[person]}>
          {u.name}
        </Link>
      ))}
    </nav>
  )
}

const PersonPage = function* () {
  const user = yield* useLoader(person)
  return (
    <>
      <TeamNav />
      <p className="profile">
        {user.name} {user.canEdit ? 'edits the board' : 'reads the board'}
      </p>
    </>
  )
}

/** A page per route. The router runs a page's loaders before it shows the page, under `Pending` with its `fallback`. */
export const people = router({
  table,
  pages: {
    team: { render: () => <TeamNav /> },
    person: { render: () => <PersonPage />, loaders: [person], fallback: <p className="muted">Loading</p> },
  },
  notFound: () => <TeamNav />,
})

/** Runs `people` with `startRouter` in its own container while the page is open, so its links change the address bar. */
export const RouterDemo = function* () {
  const host = yield* useRef<HTMLDivElement>()
  yield* useEffect(function* () {
    const repo = yield* UserRepo
    yield* Effect.acquireRelease(
      Effect.promise(() => startRouter(people, { container: host.current!, layer: Layer.succeed(UserRepo, repo) })),
      (nav) => Effect.promise(() => nav.dispose()),
    )
  })
  return (
    <section className="demo router">
      <h2>Router</h2>
      <div ref={host} className="routed" />
    </section>
  )
}
