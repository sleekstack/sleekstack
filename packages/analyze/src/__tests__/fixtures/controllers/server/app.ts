import { start } from '@sleekstack/start'
import { Layer } from 'effect'
import { Users } from '../services'

export const app = start({ layer: Layer.succeed(Users, { name: (id) => String(id) }) })
