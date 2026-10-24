import { Layer } from 'effect'
import { Config } from '../src/tags'

/** Shadowed by the server entry's explicit `layer`, though still built for `db.layer.ts`. */
export default Layer.succeed(Config, { greeting: 'hello' })
