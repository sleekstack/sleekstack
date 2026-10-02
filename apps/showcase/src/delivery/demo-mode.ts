/**
 * apps/showcase/src/delivery/demo-mode.ts
 *
 * Demo-mode toggle: a cookie read on the server. When set, `runApp` provides
 * infrastructure/demo.live.ts over the app's Layers for that operation.
 */
import 'server-only'
import { cookies } from 'next/headers'
import { DEMO_COOKIE } from '../domain/demo-cookie'

export { DEMO_COOKIE }

export async function isDemoMode(): Promise<boolean> {
  const store = await cookies()
  return store.get(DEMO_COOKIE)?.value === '1'
}
