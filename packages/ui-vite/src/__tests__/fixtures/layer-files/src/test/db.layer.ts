import { Layer } from 'effect'
import { Db } from '../tags'

/** Under `test/`: never composed (it would conflict with `server/db.layer.ts`). */
export default Layer.succeed(Db, { greeting: 'fake' })
