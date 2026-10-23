import { DbLive } from './db'

/** SQLite at `CONDUIT_DB` (default `./data/conduit.db`), read at import: a test sets it before importing the app. */
export default DbLive(process.env.CONDUIT_DB)
