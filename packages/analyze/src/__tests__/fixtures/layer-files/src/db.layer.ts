import { Effect, Layer } from 'effect'
import { Config, Db } from '../services'

export default Layer.effect(
  Db,
  Effect.map(Config, (config) => ({ url: config.url })),
)
