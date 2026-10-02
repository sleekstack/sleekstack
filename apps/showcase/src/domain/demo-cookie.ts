/**
 * apps/showcase/src/domain/demo-cookie.ts
 *
 * The demo-mode cookie's name (R9), shared by the server read
 * (`delivery/demo-mode.ts`) and the client toggle (`client/components/DemoToggle.tsx`). Its own
 * file (no `server-only`) so the client can import it without dragging in
 * `next/headers`.
 */
export const DEMO_COOKIE = 'sleekstack_demo'
