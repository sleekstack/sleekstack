'use server'
import { defineEffect } from '@sleekstack/kit/next'
import { ActivityLog } from '../domain/tags'
import { demoLayers } from '../server/demo.server'

// Only async function exports: Next rejects any other export from a 'use server' file.
const pingEffect = defineEffect(function* (from: string) {
  const log = yield* ActivityLog
  log.record(`Island ping from ${from}`)
  return from
}, [ActivityLog], { provide: demoLayers })

export async function pingFromIsland(from: string) {
  return pingEffect(from)
}
