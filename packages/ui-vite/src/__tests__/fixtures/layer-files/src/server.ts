import { start } from '@sleekstack/start'
import { Layer } from 'effect'
import { Config } from './tags'

/** No Layer list: the Layer Files are discovered; the explicit `layer` shadows their `Config`. */
export const app = start({ layer: Layer.succeed(Config, { greeting: 'hi' }) })
