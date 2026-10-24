import { Effect, Layer } from 'effect'
import { Clock, Smtp } from '../services'

/** A test-only Layer: never composed, so neither its `Clock` nor its `Smtp` counts. */
export default Layer.effect(Clock, Effect.as(Smtp, { now: () => 0 }))
