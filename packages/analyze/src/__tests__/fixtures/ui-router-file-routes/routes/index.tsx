import { Repo } from '../tags'

export default function* Home() {
  const r = yield* Repo
  return <p>{r}</p>
}
