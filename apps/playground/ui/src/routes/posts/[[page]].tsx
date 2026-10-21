import { Route } from '@sleekstack/router'

// `/posts/:page?`: `/posts` (no `page`) and `/posts/2`.
export default function* Posts() {
  const route = yield* Route
  return <h1>{`Posts page ${route.params.page ?? '1'}`}</h1>
}
