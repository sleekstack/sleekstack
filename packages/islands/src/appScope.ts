import { createAppScope, type AppScopeHandle } from '@sleekstack/kit/react'

type Provide = Parameters<typeof createAppScope>[0]

/** One lazily built app scope per registry, reference-counted by active Islands. */
export const sharedAppScope = (provide: Provide) => {
  let current: Promise<AppScopeHandle> | undefined
  let count = 0
  return {
    /** Builds on first use; a failed build is dropped so the next acquire retries. Pair each success with `release`. */
    acquire: async (): Promise<AppScopeHandle> => {
      count++
      const p = (current ??= createAppScope(provide))
      try {
        return await p
      } catch (e) {
        count--
        if (current === p) current = undefined
        throw e
      }
    },
    /** Closes the scope when the last Island lets go; the next acquire rebuilds it. */
    release: () => {
      if (--count > 0 || !current) return
      const p = current
      current = undefined
      void p.then((h) => h.close(), () => {})
    },
  }
}

/**
 * Server-side app scope for one registry: built once, lazily, and kept for the life of the process
 * (never per render, never closed), so finalizer-bearing services are not leaked per request.
 * A failed build is dropped so the next render retries.
 */
export const processAppScope = (provide: Provide) => {
  let current: Promise<AppScopeHandle> | undefined
  return () =>
    (current ??= createAppScope(provide).catch((e: unknown) => {
      current = undefined
      throw e
    }))
}
