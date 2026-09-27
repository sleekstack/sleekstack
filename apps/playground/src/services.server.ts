/**
 * apps/playground/src/services.server.ts
 *
 * Server-only Layer implementations (R11). Carries SERVER_ONLY_MARKER so
 * src/__tests__/bundle.test.ts can assert a Tag-only client bundle (built
 * from ./client-tags-entry.ts) never contains it.
 */
import { Effect, Layer } from 'effect'
import { HttpClient, Logger, UserApi } from './tags'

export const SERVER_ONLY_MARKER = 'sleekstack-server-only-impl-9f2c1a4e'

export const LoggerLayer = Layer.scoped(
  Logger,
  Effect.acquireRelease(
    Effect.sync(() => {
      console.log(SERVER_ONLY_MARKER, '[Logger] acquired')
      return {
        prefix: '[App]',
        log: (msg: string) => console.log('[App]', msg),
      }
    }),
    () => Effect.sync(() => console.log('[Logger] released — scope finalized')),
  ),
)

export const HttpClientLayer = Layer.scoped(
  HttpClient,
  Effect.acquireRelease(
    Effect.sync(() => {
      console.log('[HttpClient] acquired')
      return {
        async get(url: string): Promise<string> {
          await new Promise((r) => setTimeout(r, 200))
          return `Response from ${url}`
        },
      }
    }),
    () => Effect.sync(() => console.log('[HttpClient] released — scope finalized')),
  ),
)

export const UserApiLayer = Layer.scoped(
  UserApi,
  Effect.acquireRelease(
    Effect.sync(() => {
      console.log('[UserApi] acquired')
      return {
        async getGreeting(name: string): Promise<string> {
          await new Promise((r) => setTimeout(r, 100))
          return `Hello, ${name}! (from UserApi)`
        },
      }
    }),
    () => Effect.sync(() => console.log('[UserApi] released — scope finalized')),
  ),
)

/** Mock HttpClient used by the nested/shadowed scope in the demo. */
export const MockHttpClientLayer = Layer.succeed(HttpClient, {
  async get(url: string): Promise<string> {
    return `[MOCK] Response from ${url}`
  },
})
