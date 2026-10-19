import { Route } from '@sleekstack/router'

export default function* User() {
  const route = yield* Route
  return <h1>{`User ${route.params.id}`}</h1>
}
