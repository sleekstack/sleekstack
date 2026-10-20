import { Repo } from './tags'

export default function* TagsPage() {
  const r = yield* Repo
  return <p>{r}</p>
}
