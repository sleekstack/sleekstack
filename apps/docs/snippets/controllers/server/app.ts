import { start } from '@sleekstack/start'

/**
 * The server entry. The Vite plugin discovers the Controllers under `server/routes`, the Layer Files (`notes.layer.ts`
 * provides `Notes`), the RPC Files, the Manifest and the Server Root, so nothing is listed here.
 */
export const app = start()
