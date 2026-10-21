import { Db } from '../../tags'

export default function* Stock() {
  const d = yield* Db
  return <p>{d}</p>
}
