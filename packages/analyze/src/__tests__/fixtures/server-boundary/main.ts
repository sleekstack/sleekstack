import layer from 'virtual:sleek/server'
import { live } from './direct.server' // @error ServerFileInClientGraph
import type { Db } from './typed.server'
import './page'

export const app: [unknown, unknown, Db?] = [layer, live]
