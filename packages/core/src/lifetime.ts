/**
 * packages/core/src/lifetime.ts
 *
 * The lifetime matrix (app <- app; request <- app, request; component <- app, component) is enforced by the analyzer.
 */

/** How long a service instance lives: once per app, per request scope, or per component scope. */
export type Lifetime = 'app' | 'request' | 'component'
