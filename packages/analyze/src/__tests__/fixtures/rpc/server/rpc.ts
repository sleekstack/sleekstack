export default {
  Tally: { add: 'POST api/tally', get: 'GET api/tally' },
  Items: { get: 'GET api/items/[id]', note: 'GET api/notes/[id]' },
  Ping: { now: 'GET api/tally' }, // @error RpcNameCollision
  Clock: { now: 'GET api/tally' }, // @error RpcNameCollision
  Broken: {
    unknown: 'GET api/nowhere', // @error RpcRouteUnknown
    missing: 'DELETE api/tally', // @error RpcRouteUnknown
    method: 'DELETE api/notes/[id]', // @error RpcRouteUnknown
    loose: 'PUT api/tally', // @error RpcMethodShape
    raw: 'GET api/raw', // @error RpcMethodShape
    inferred: 'GET api/inferred', // @error RpcMethodShape
    over: 'GET api/local', // @error ServerFileInClientGraph
    bad: 42, // @error ServerFileShape
  },
}
