import { rpc, type RpcWrap } from '@sleekstack/start'
import { Effect } from 'effect'
import { Viewer } from '../src/viewer'

/** The RPC face's viewer: the directory `wrap` never runs here. */
const wrap: RpcWrap = (next) => Effect.provideService(next, Viewer, 'rpc')

export default rpc({ People: { get: 'GET users/[id]', rename: 'PUT users/[id]' } }, { wrap })
