import { Effect, Layer } from 'effect'
import { Db, Repo } from '../services'

/** First by path, yet composed last: it requires `Db`, which requires `Config`. */
export default Layer.effect(
  Repo,
  Effect.map(Db, (db) => ({ url: db.url })),
)
