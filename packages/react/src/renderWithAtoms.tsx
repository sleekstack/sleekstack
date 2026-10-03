/**
 * packages/react/src/renderWithAtoms.tsx
 *
 * Server request wrapper: renders a tree under a request registry, so each `LayerProvider` acquires its scopes
 * per request (keyed by `useId`, reused across Suspense retries), and closes them all LIFO when the render ends.
 */

import React from 'react'
import { renderToPipeableStream, renderToString, type PipeableStream, type RenderToPipeableStreamOptions } from 'react-dom/server'
import { RegistryContext, type RequestRegistry } from './context'
import { closeRegistry } from './managedScope'

/** A `renderToPipeableStream` handle whose provider scopes close once the piped destination ends, on shell error, or on `abort`. */
export interface RenderWithAtomsStream extends PipeableStream {
  /** Resolves once every provider scope of the request has closed. */
  readonly closed: Promise<void>
}

// renderToString cannot wait, and even a sync layer's scope opens on a promise: re-render while the last pass
// opened new scopes, after a macrotask turn lets sync opens settle. Async opens still render their fallback.
// ponytail: one pass per nesting level of sync providers; stream mode for anything that must wait.
const renderString = async (tree: React.ReactNode, registry: RequestRegistry): Promise<string> => {
  try {
    for (;;) {
      const before = registry.scopes.size
      const html = renderToString(tree)
      if (registry.scopes.size === before) return html
      await new Promise((r) => setTimeout(r, 0))
    }
  } finally {
    await closeRegistry(registry)
  }
}

/**
 * Renders `element` on the server with request-owned provider scopes, so atom hooks work during the render.
 * String mode resolves the HTML after closing every scope; stream mode closes them when the piped destination
 * ends (finish, close or error), on shell error, or on `abort` — a stream that is never piped must be aborted.
 *
 * @param element - The tree to render. Pass `{ stream: options }` as a second argument for `renderToPipeableStream` with `options`.
 * @returns The HTML (string mode) or the stream handle.
 *
 * @example
 * ```tsx
 * const html = await renderWithAtoms(<LayerProvider provide={[app]}><Page /></LayerProvider>)
 * ```
 */
export function renderWithAtoms(element: React.ReactNode): Promise<string>
export function renderWithAtoms(element: React.ReactNode, options: { readonly stream: RenderToPipeableStreamOptions }): RenderWithAtomsStream
export function renderWithAtoms(element: React.ReactNode, options?: { readonly stream: RenderToPipeableStreamOptions }): Promise<string> | RenderWithAtomsStream {
  const registry: RequestRegistry = { scopes: new Map(), closers: [] }
  const tree = <RegistryContext.Provider value={registry}>{element}</RegistryContext.Provider>
  if (!options) return renderString(tree, registry)
  const { onShellError } = options.stream
  let done!: () => void
  const closed = new Promise<void>((r) => (done = r))
  // Errors inside a Suspense boundary do not end the request (React renders on), so `onError` does not close.
  const close = () => void closeRegistry(registry).then(done)
  const stream = renderToPipeableStream(tree, {
    ...options.stream,
    onShellError: (e) => { try { onShellError?.(e) } finally { close() } },
  })
  return {
    closed,
    pipe: <W extends NodeJS.WritableStream>(destination: W) => {
      // Scopes live until the output is flushed: the destination finishes, or a fatal error / client disconnect ends it.
      const events = destination as unknown as { on(event: string, listener: () => void): void }
      events.on('finish', close)
      events.on('close', close)
      events.on('error', close)
      return stream.pipe(destination)
    },
    abort: (reason) => { stream.abort(reason); close() },
  }
}
