import { rpc } from '@sleekstack/start'

/**
 * The RPC Manifest: `NoteLookup` wraps two Controller Methods as a Server Service, at the wire ids `NoteLookup.find`
 * and `NoteLookup.remove`. A route name is typed from the generated route table, so a renamed Controller fails here.
 */
export default rpc({ NoteLookup: { find: 'GET notes/[id]', remove: 'DELETE notes/[id]' } })
