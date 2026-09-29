'use server'
import { action } from '@sleekstack/kit/next'
import { ActivityLog } from '../domain/tags'
import { demoLayers } from '../server/demo.server'

// Only async function exports: Next rejects any other export from a 'use server' file.
export async function pingFromIsland(from: string) {
  const op = action((log) => (who: string) => {
    log.record(`Island ping from ${who}`)
    return who
  }, [ActivityLog], { provide: await demoLayers() })
  return op(from)
}
