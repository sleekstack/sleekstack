import { Effect, Layer } from 'effect'
import { A, App, Req, Z } from './tags'

export const AppLive = Layer.succeed(App, {})
/** Requires the app singleton: passes over the app root. */
export const ReqLive = Layer.effect(Req, Effect.map(App, () => ({})))
/** Requires a Tag nobody provides. */
export const BadReqLive = Layer.effect(Req, Effect.map(Z, () => ({})))
/** Shadows the app's App. */
export const AppMock = Layer.succeed(App, {})
export const ALive = Layer.succeed(A, {})
