/**
 * packages/react/src/transport.ts
 *
 * The atom snapshot transport: a `<script type="application/json" data-sleekstack-atoms="<id>">` tag. The single
 * owner of locating, parsing and encoding it, used by `LayerProvider` (seeding) and `AtomsSnapshot` (emitting).
 */

import type { Snapshot } from '@sleekstack/core'

export const ATTR = 'data-sleekstack-atoms'

declare const process: { readonly env: { readonly NODE_ENV?: string } }
const devWarn = (message: string) => {
  if (typeof process === 'undefined' || process.env.NODE_ENV !== 'production') console.warn(message)
}

/** The tag for `id`; for `''` (no `snapshotId`) only when exactly one unkeyed tag exists. */
const find = (id: string): Element | undefined => {
  if (typeof document === 'undefined') return undefined
  const tags = [...document.querySelectorAll(`script[${ATTR}]`)].filter((t) => t.getAttribute(ATTR) === id)
  return id === '' && tags.length !== 1 ? undefined : tags[0]
}

/** Raw tag content for `id` (re-rendered verbatim by `AtomsSnapshot` on the client), or `undefined` without one. */
export const snapshotText = (id: string): string | undefined => find(id)?.textContent ?? undefined

/** The snapshot in the tag for `id`; a missing tag is `undefined`, malformed or non-object content `{}` with a dev warning. */
export const readSnapshot = (id: string): Snapshot | undefined => {
  const text = snapshotText(id)
  if (text === undefined) return undefined
  try {
    const value: unknown = JSON.parse(text)
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Snapshot
  } catch {
    // falls through to the warning
  }
  devWarn(`[@sleekstack/react] ignored an atom snapshot tag (${ATTR}="${id}") that is not a JSON object`)
  return {}
}

/** The seed for a provider: its `hydrate` prop, else its transport tag. */
export const seedFor = (props: { readonly hydrate?: Snapshot; readonly snapshotId?: string }): Snapshot | undefined =>
  props.hydrate ?? readSnapshot(props.snapshotId ?? '')

/** JSON safe inside a `<script>`: `<`, `>`, `&`, U+2028 and U+2029 become `\u` escapes, so nothing breaks out. */
export const encodeSnapshot = (snapshot: Snapshot): string =>
  JSON.stringify(snapshot).replace(/[<>&\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
