import { Cookies, rpc, type RpcWrap } from '@sleekstack/start'
import { Effect } from 'effect'
import { Viewer } from '../src/notes'

/** The RPC face's viewer is the `user` cookie. */
const wrap: RpcWrap = (next) =>
  Effect.flatMap(Cookies, (cookies) => Effect.provideService(next, Viewer, cookies.get('user') ?? 'anonymous'))

export default rpc({ Notes: { count: 'GET api/count', save: 'PUT api/notes/[id]' } }, { wrap, bodyLimit: 64 })
