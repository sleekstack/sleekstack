import { Effect, Layer } from 'effect'
import { Config, Db } from '../src/tags'

export default Layer.effect(Db, Effect.map(Config, (config) => ({ greeting: config.greeting })))
