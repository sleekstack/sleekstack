import type { Child } from '@sleekstack/ui'
import { Db, item } from '../../tags'

export const loaders = [item] // @error MissingDependency

export default function* Shop({ children }: { children: Child }) { // @error MissingDependency
  const d = yield* Db
  return <section title={d}>{children}</section>
}
