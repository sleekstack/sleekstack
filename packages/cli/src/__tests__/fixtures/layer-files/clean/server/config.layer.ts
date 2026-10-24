import { Layer } from 'effect'
import { Config } from '../services'

export default Layer.succeed(Config, { url: 'file:app.db' })
