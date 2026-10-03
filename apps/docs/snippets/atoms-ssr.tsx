import type { ReactNode } from 'react'
import type { Writable } from 'node:stream'
import { AtomsSnapshot, LayerProvider, renderWithAtoms } from '@sleekstack/react'

declare const app: Parameters<typeof LayerProvider>[0]['provide'] extends readonly (infer L)[] | undefined ? L : never
declare const Page: () => ReactNode
declare const tree: ReactNode
declare const res: Writable

// String mode: resolves the HTML after closing every scope.
export const html = await renderWithAtoms(
  <LayerProvider provide={[app]} snapshotId="main">
    <Page />
    <AtomsSnapshot />
  </LayerProvider>,
)

// Stream mode: renderToPipeableStream options; scopes close when the piped destination ends,
// on shell error, or on abort. `closed` resolves once they have.
const stream = renderWithAtoms(tree, { stream: { onShellReady: () => stream.pipe(res) } })
