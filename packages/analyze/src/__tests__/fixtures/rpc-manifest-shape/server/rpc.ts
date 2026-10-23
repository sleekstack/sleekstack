const rpc = (table: object) => table
const table = { Tally: { add: 'POST api/tally' } }

export default rpc(table) // @error ServerFileShape
