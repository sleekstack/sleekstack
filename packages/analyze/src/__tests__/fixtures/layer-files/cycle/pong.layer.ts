import { Effect, Layer } from 'effect'
import { Ping, Pong } from '../services'

export default Layer.effect(Pong, Effect.as(Ping, {})) // @error LayerFileCycle
