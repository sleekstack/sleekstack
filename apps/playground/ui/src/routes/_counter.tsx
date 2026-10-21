import { useLocal } from '@sleekstack/ui'

// A `_` file is not a route: a helper beside the pages.
export function* Counter() {
  const [n, set] = yield* useLocal(0)
  return <button onClick={() => set(n + 1)}>{`count ${n}`}</button>
}
