import { Effect, Layer } from 'effect'
import { Ping, Pong } from '../services'

export default Layer.effect(Ping, Effect.as(Pong, {}))
