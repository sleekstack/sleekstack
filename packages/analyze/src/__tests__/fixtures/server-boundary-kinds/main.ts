import layer from 'virtual:sleek/server'
import { users } from './users.controller'
import { inner } from './server/routes/_defaults'
import { outer } from './lib/_defaults'

export const app = [layer, users, inner, outer]
