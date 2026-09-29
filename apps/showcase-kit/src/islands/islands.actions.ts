'use server'
import { effect } from '@sleekstack/kit/next'
import { ActivityLog } from '../domain/tags'
import { demoLayers } from '../server/demo.server'

// Only async function exports: Next rejects any other export from a 'use server' file.
export async function pingFromIsland(from: string) {
  return effect(
    function* () {
      const log = yield* ActivityLog
      log.record(`Island ping from ${from}`)
      return from
    },
    { provide: demoLayers },
  )
}
