/**
 * apps/showcase-kit/src/domain/demo-cookie.ts
 *
 * The demo-mode cookie's name (R9), shared by the server read
 * (`demo.server.ts`) and the client toggle (`client/DemoToggle.tsx`). Its own
 * file (no `server-only`) so the client can import it without dragging in
 * `next/headers`.
 */
export const DEMO_COOKIE = 'sleekstack_demo'
