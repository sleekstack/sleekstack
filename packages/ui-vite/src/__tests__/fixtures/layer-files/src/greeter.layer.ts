import { Effect, Layer } from 'effect'
import { Db, Greeter } from './tags'

/** Outside the server directory: Layer Files are found anywhere in the program. */
export default Layer.effect(
  Greeter,
  Effect.map(Db, (db) => ({ greet: (name: string) => `${db.greeting}, ${name}` })),
)
