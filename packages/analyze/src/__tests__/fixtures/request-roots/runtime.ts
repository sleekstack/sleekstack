import { Effect } from 'effect'
import { configureRuntime, runEffect } from '../../../../../runtime/src/index'
import { ALive, AppLive, AppMock, BadReqLive, ImportedChoice, ReqLive } from './live'

configureRuntime({ layer: AppLive })

declare const cond: boolean
declare const opts: { request?: typeof ReqLive }
const Untyped: any = ReqLive
const e = Effect.void
const choice = cond ? ReqLive : ALive
const none = undefined
const maybe = cond ? ReqLive : none

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
  runEffect(e, { request: choice }),
  runEffect(e, { request: ImportedChoice }),
  runEffect(e, { overrides: maybe }),
  runEffect(e, { 'request': ReqLive, ['overrides']: ALive }),
  runEffect(e, { request: none }),
]
