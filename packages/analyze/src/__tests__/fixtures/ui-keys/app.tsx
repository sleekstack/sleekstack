import { Effect } from 'effect'

const Row = (p: { id: number }) => Effect.succeed(<li>{p.id}</li>)
const ids = [1, 2, 3]

// The rules are per call: no mount needed.
export const App = () =>
  Effect.gen(function* () {
    const rows = yield* Effect.all(ids.map((id) => <Row id={id} />)) // @error MissingKey
    const keyed = yield* Effect.all(ids.map((id) => <Row key={String(id)} id={id} />))
    const helper = ids.map((id) => <li>{id}</li>)
    void [rows, keyed, helper]
    return (
      <main>
        <ul>{ids.map((id) =>
          <li>{id}</li> // @error MissingKey
        )}</ul>
        <ul>{ids.map((id) => <li key={String(id)}>{id}</li>)}</ul>
        <ul>
          {ids.flatMap((id) => [
            <li key={`a${id}`}>{id}</li>,
            <li>{id}</li>, // @error MissingKey
          ])}
        </ul>
        <ol>
          {Array.from(ids, (id) =>
            id > 1
              ? <Row key={String(id)} id={id} />
              : <>{id}</>, // @error MissingKey
          )}
        </ol>
        <ul>{ids.map((id) => <li key={String(id)}>{ids.map((j) =>
          <b>{j}</b> // @error MissingKey
        )}</li>)}</ul>
        {[...ids.map((id) =>
          <Row id={id} /> // @error MissingKey
        )]}
      </main>
    )
  })
