import { Db } from '../tags'

export default function* About() { // @error MissingDependency
  const d = yield* Db
  return <p>{d}</p>
}
