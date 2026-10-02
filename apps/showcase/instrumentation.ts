/**
 * apps/showcase/instrumentation.ts
 *
 * Next's instrumentation hook: guarded to the nodejs runtime so an edge import never breaks the
 * build, then dynamically imports the server-only runtime module, whose top-level call configures
 * the app runtime once per process.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./src/delivery/runtime.server')
  }
}
