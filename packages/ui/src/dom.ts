import type { Cause, Effect, Layer } from 'effect'
import { Component, createElement, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { reportRenderError, runToNode } from './component'
import type { Node } from './node'

export interface Mounted {
  dispose(): Promise<void>
}

type OnError = (cause: Cause.Cause<unknown>) => void

// A throwing guest renders as nothing; the error goes through `report` (not React's act rethrow).
class GuestBoundary extends Component<{ report: (error: unknown) => void; children?: ReactNode }, { failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override componentDidCatch(error: unknown) {
    this.props.report(error)
  }
  override render() {
    return this.state.failed ? null : this.props.children
  }
}

// Per-container generation token: a mount whose generation moved before it resolved writes nothing.
interface ContainerState {
  gen: number
  roots: Array<Root>
}
const states = new WeakMap<Element, ContainerState>()

const teardown = (container: Element, state: ContainerState): void => {
  for (const root of state.roots.splice(0)) root.unmount()
  container.replaceChildren()
}

const build = (node: Node, doc: Document, roots: Array<Root>, onError?: OnError): globalThis.Node | null => {
  try {
    switch (node._tag) {
      case 'Text':
        return doc.createTextNode(node.text)
      case 'Fragment': {
        const frag = doc.createDocumentFragment()
        for (const c of node.children) append(frag, build(c, doc, roots, onError))
        return frag
      }
      case 'Element': {
        const el = doc.createElement(node.tag)
        for (const [k, v] of Object.entries(node.attrs)) el.setAttribute(k, v)
        for (const c of node.children) append(el, build(c, doc, roots, onError))
        return el
      }
      case 'Guest': {
        // One React root per guest host; `display: contents` keeps the host out of layout.
        const host = doc.createElement('sleek-guest')
        host.style.display = 'contents'
        const report = (error: unknown) => reportRenderError(error, onError)
        const root = createRoot(host, { onCaughtError: () => {}, onUncaughtError: report })
        roots.push(root)
        flushSync(() => root.render(createElement(GuestBoundary, { report }, createElement(node.component, node.props))))
        return host
      }
    }
  } catch (error) {
    reportRenderError(error, onError)
    return null
  }
}

const append = (parent: globalThis.Node, child: globalThis.Node | null): void => {
  if (child) parent.appendChild(child)
}

/**
 * DOM renderer. Resolves once the tree and every guest root is committed into `container`.
 * A later `mount` on the same container wins; each handle disposes only its own generation.
 */
export const mount = async <E, A, LE = never>(
  app: Effect.Effect<Node, E, A>,
  opts: { layer: Layer.Layer<A, LE, never>; container: Element; onError?: OnError },
): Promise<Mounted> => {
  const { container, onError } = opts
  let state = states.get(container)
  if (!state) states.set(container, (state = { gen: 0, roots: [] }))
  const gen = ++state.gen
  const current = (): boolean => state.gen === gen
  const noop: Mounted = { dispose: async () => {} }
  // Re-mount clears the previous generation first, so a pending or rejecting mount orphans nothing.
  teardown(container, state)
  const node = await runToNode(app, opts.layer, onError)
  if (!current()) return noop
  const roots: Array<Root> = []
  const tree = build(node, container.ownerDocument, roots, onError)
  // Guest callbacks (`onError`) may start a newer mount while building.
  if (!current()) {
    for (const root of roots) root.unmount()
    return noop
  }
  state.roots = roots
  append(container, tree)
  return {
    dispose: async () => {
      if (current()) teardown(container, state)
    },
  }
}
