import layer from 'virtual:sleek/server'
import type { Db } from './profiles.server'

export const app: [unknown, Db?] = [layer]
