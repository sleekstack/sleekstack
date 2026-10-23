import { Notes } from 'virtual:sleek/rpc'
import * as notes from './notes.rpc'
import * as db from './db.layer'
import * as manifest from './server/rpc'
import * as root from './server/_app'

export const page = [Notes, notes, db, manifest, root]
