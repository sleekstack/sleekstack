import { Effect, Option } from 'effect'
import type { Child } from '@sleekstack/ui/jsx-runtime'
import { jsx } from '@sleekstack/ui/jsx-runtime'
import { match, type RouteTable } from './index'
import { type Loader, Loaders, prefetchLoader } from './loader'

/** `Link` props: `table` matches `href`; `code` imports the route's page (the `lazy` import) and `loaders` are its loaders. */
export interface LinkProps<R> {
  readonly href: string
  readonly table: RouteTable
  readonly code?: () => Promise<unknown>
  readonly loaders?: ReadonlyArray<Loader<any, any, any, R>>
  /** `false` turns hover and focus prefetching off. */
  readonly prefetch?: boolean
  readonly children?: Child
}

/**
 * An `<a href>` that prefetches its route's code and loaders on hover or focus (R6), unless `prefetch={false}`.
 * Loads are shared with the page's reads and dropped after a bounded time unread; a prefetch error is silent (R13).
 */
export const Link = <R>({ href, table, code, loaders = [], prefetch = true, children }: LinkProps<R>) => {
  const warm = Effect.suspend(() => {
    void code?.().catch(() => {})
    const m = match(table, href)
    return Option.isNone(m)
      ? Effect.void
      : Effect.forEach(loaders, (l) => prefetchLoader(l, m.value), { discard: true })
  }).pipe(Effect.catchAllCause(() => Effect.void))
  return prefetch
    ? jsx('a', { href, onMouseEnter: () => warm, onFocus: () => warm, children })
    : jsx('a', { href, children })
}
