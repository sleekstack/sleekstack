import { Effect, Option } from 'effect'
import type { Child, JSX } from '@sleekstack/ui/jsx-runtime'
import { jsx } from '@sleekstack/ui/jsx-runtime'
import { match, type RouteTable } from './index'
import { type Loader, Loaders, prefetchLoader } from './loader'

/** Distributes over a union, so `class` / `className` stay one-of-never-both. */
type OmitEach<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
/** The `<a>` attributes `Link` passes through: no `href` (re-declared), `children`, `key`, `ref` or event handler (`on*`). */
type AnchorAttrs = OmitEach<JSX.IntrinsicElements['a'], 'href' | 'children' | 'key' | 'ref' | `on${string}`>

/**
 * `Link` props: `table` matches `href`; `code` imports the route's page (the `lazy` import) and `loaders` are its loaders.
 * Every other non-event anchor attribute (`class`, `id`, `aria-*`, `data-*`, `rel`, `target`, ...) goes to the `<a>`.
 */
export type LinkProps<R> = AnchorAttrs & {
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
export const Link = <R>({ table, code, loaders = [], prefetch = true, ...attrs }: LinkProps<R>) => {
  const warm = Effect.suspend(() => {
    const url = new URL(attrs.href, location.href)
    const m = url.origin === location.origin ? match(table, url.pathname) : Option.none()
    if (Option.isNone(m)) return Effect.void
    void code?.().catch(() => {})
    return Effect.forEach(loaders, (l) => prefetchLoader(l, m.value), { discard: true })
  }).pipe(Effect.catchAllCause(() => Effect.void))
  return jsx('a', prefetch ? { ...attrs, onMouseEnter: () => warm, onFocus: () => warm } : attrs)
}
