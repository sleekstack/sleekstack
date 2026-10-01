import { Effect } from 'effect'
import { configureRuntime, runEffect } from '../../../../../runtime/src/index'
import { ALive, AppLive, AppMock, BadReqLive, ReqLive } from './live'

configureRuntime({ layer: AppLive })

declare const cond: boolean
declare const opts: { request?: typeof ReqLive }
const Untyped: any = ReqLive
const e = Effect.void

export const calls = [
  runEffect(e),
  runEffect(e, {}),
  runEffect(e, { request: ReqLive }),
  runEffect(e, { request: BadReqLive }), // @error MissingDependency
  runEffect(e, { overrides: cond ? AppMock : ALive }),
  runEffect(e, { overrides: cond ? ALive : undefined }),
  runEffect(e, opts), // @error NonLiteralOptions
  runEffect(e, { ...opts }), // @error NonLiteralOptions
  runEffect(e, { request: Untyped }), // @error Computed
]
