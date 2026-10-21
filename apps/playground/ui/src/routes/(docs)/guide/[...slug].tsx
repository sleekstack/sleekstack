import { Route } from '@sleekstack/router'

// `/guide/*slug`: one or more segments, joined with `/` (`/guide/a/b` gives `a/b`); `/guide` does not match.
export default function* Guide() {
  const route = yield* Route
  return <h1>{`Guide ${route.params.slug}`}</h1>
}
