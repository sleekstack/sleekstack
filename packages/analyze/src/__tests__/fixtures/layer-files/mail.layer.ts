import { Effect, Layer } from 'effect'
import { Mail, Smtp } from './services'

export default Layer.effect(Mail, Effect.as(Smtp, {})) // @error MissingDependency
