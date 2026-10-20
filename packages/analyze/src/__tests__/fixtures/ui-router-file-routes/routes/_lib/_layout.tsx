import type { Child } from '@sleekstack/ui'
import { Db } from '../../tags'

// Under a `_` directory: not applied, so its missing Db is never reported.
export default function* Ignored({ children }: { children: Child }) {
  const d = yield* Db
  return <aside title={d}>{children}</aside>
}
