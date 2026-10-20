import { Repo } from '../tags'

export default function* NotFound() {
  const r = yield* Repo
  return <h1>{`Not found ${r}`}</h1>
}
