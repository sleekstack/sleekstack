import { Route } from '@sleekstack/router'
import type { Child } from '@sleekstack/ui'

export default function* Root({ children }: { children: Child }) {
  const m = yield* Route
  return <main data-route={m.name}>{children}</main>
}
