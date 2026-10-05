/**
 * packages/react/src/AtomsSnapshot.tsx
 *
 * `<AtomsSnapshot />`: the nearest provider's serializable atoms as a JSON script tag. Render it inside the
 * provider after the atom readers; tree order decides which atoms the store has built.
 */

import React, { useContext } from 'react'
import { dehydrate } from '@sleekstack/core'
import { ProviderContext, RegistryContext } from './context'
import { SnapshotIdContext } from './LayerProvider'
import { ATTR, encodeSnapshot, snapshotText } from './transport'

/**
 * Emits `<script type="application/json" data-sleekstack-atoms={snapshotId}>` with the dehydrated store of the
 * nearest {@link LayerProvider}. On the client it re-renders the server's content verbatim (no mismatch).
 *
 * @throws `Error` outside a `LayerProvider`.
 *
 * @example
 * ```tsx
 * <LayerProvider provide={[app]} snapshotId="main"><Page /><AtomsSnapshot /></LayerProvider>
 * ```
 */
export function AtomsSnapshot() {
  const state = useContext(ProviderContext)
  if (state === null) {
    throw new Error(
      'AtomsSnapshot needs a <LayerProvider> above this component: atom state lives in the nearest provider.',
    )
  }
  const id = useContext(SnapshotIdContext)
  const server = useContext(RegistryContext) !== null || typeof window === 'undefined'
  const html = server ? encodeSnapshot(state.atoms ? dehydrate(state.atoms) : {}) : (snapshotText(id) ?? '{}')
  return (
    <script
      type="application/json"
      {...{ [ATTR]: id }}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
