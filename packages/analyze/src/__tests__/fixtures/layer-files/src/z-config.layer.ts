import { Layer } from 'effect'
import { Config } from '../services'

const ConfigLive: Layer.Layer<Config> = Layer.succeed(Config, { url: 'file:app.db' })

/** A default export naming a const, and a named export beside it. */
export { ConfigLive }
export default ConfigLive
