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
