/**
 * apps/playground/src/client-tags-entry.ts
 *
 * A build entry that imports only Tags (R11). Its own build output is
 * asserted by src/__tests__/bundle.test.ts to never contain
 * SERVER_ONLY_MARKER from ./services.server.ts.
 */
export * from './tags'
