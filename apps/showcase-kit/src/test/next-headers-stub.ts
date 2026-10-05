/**
 * apps/showcase-kit/src/test/next-headers-stub.ts
 *
 * `next/headers`'s `cookies()` needs Next's request AsyncLocalStorage,
 * unavailable under plain Vitest. Aliased in vitest.config.ts so
 * demo.server.ts's `cookies()` call resolves to this test-controlled jar
 * instead of throwing. `__setDemoCookie` lets a test flip demo mode on/off.
 */
let value: string | undefined

export function __setDemoCookie(v: string | undefined): void {
  value = v
}

export async function cookies(): Promise<{
  get(name: string): { readonly name: string; readonly value: string } | undefined
}> {
  return {
    get: (name) => (value !== undefined ? { name, value } : undefined),
  }
}
