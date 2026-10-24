import { rpc } from '@sleekstack/start'

/** `Tally` for the page: the tally Controller's methods as a Server Service, at the wire ids `Tally.add` and `Tally.read`. */
export default rpc({ Tally: { add: 'POST api/tally', read: 'GET api/tally' } })
