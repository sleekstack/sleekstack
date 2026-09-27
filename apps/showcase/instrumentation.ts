/**
 * apps/showcase/instrumentation.ts
 *
 * Next's instrumentation hook (R4): guarded to the nodejs runtime so an edge
 * import never breaks the build, then dynamically imports the server-only
 * runtime module, whose top-level call configures the app runtime exactly
 * once (dev HMR re-running this hits the library's same-reference no-op).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./src/server/runtime.server')
  }
}
