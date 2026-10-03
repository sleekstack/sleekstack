import type { Cause, Effect, Layer } from 'effect'
import { createElement } from 'react'
import { renderToString as reactRenderToString } from 'react-dom/server'
import { reportRenderError, runToNode } from './component'
import type { Node } from './node'

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escape = (s: string): string => s.replace(/[&<>"']/g, (c) => ESCAPES[c]!)

const serialize = (node: Node, onError?: (cause: Cause.Cause<unknown>) => void): string => {
  switch (node._tag) {
    case 'Text':
      return escape(node.text)
    case 'Fragment':
      return node.children.map((c) => serialize(c, onError)).join('')
    case 'Element': {
      const attrs = Object.entries(node.attrs)
        .map(([k, v]) => ` ${k}="${escape(v)}"`)
        .join('')
      return `<${node.tag}${attrs}>${node.children.map((c) => serialize(c, onError)).join('')}</${node.tag}>`
    }
    case 'Guest':
      try {
        return reactRenderToString(createElement(node.component, node.props))
      } catch (error) {
        reportRenderError(error, onError)
        return ''
      }
  }
}

/** String renderer (SSR and tests). Rejection contract matches `mount`. */
export const renderToString = async <E, A, LE = never>(
  app: Effect.Effect<Node, E, A>,
  opts: { layer: Layer.Layer<A, LE, never>; onError?: (cause: Cause.Cause<unknown>) => void },
): Promise<string> => serialize(await runToNode(app, opts.layer, opts.onError), opts.onError)
