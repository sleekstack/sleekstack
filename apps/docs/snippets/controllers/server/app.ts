import { start } from '@sleekstack/start'
import { NotesLive } from './notes'

/**
 * The server entry. The Vite plugin discovers the Controllers under `server/routes`, so nothing lists them here.
 * `layer` provides what their methods need; with Controllers that need nothing, `start()` alone serves them.
 */
export const app = start({ layer: NotesLive })
