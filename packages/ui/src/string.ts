import type { Cause, Effect, Layer } from 'effect'
import { createElement } from 'react'
import { renderToString as reactRenderToString } from 'react-dom/server'
import { reportRenderError, runToNode } from './component'
import type { Node } from './node'

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escape = (s: string): string => s.replace(/[&<>"']/g, (c) => ESCAPES[c]!)

const TAG = /^[a-zA-Z][a-zA-Z0-9-]*$/
const ATTR = /^[^\s"'<>\/=\x00-\x1f]+$/
const checkName = (re: RegExp, kind: string, name: string): string => {
  if (!re.test(name)) throw new TypeError(`Invalid ${kind} name: ${JSON.stringify(name)}`)
  return name
}

const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'xlink:href'])
/** Shared attribute policy: rejects invalid names, inline handlers, `srcdoc` and `javascript:` URLs. */
export const checkAttr = (name: string, value: string): void => {
  checkName(ATTR, 'attribute', name)
  const lower = name.toLowerCase()
  const unsafeUrl = URL_ATTRS.has(lower) && /^javascript:/i.test(value.replace(/[\s\x00-\x1f]/g, ''))
  if (lower.startsWith('on') || lower === 'srcdoc' || unsafeUrl)
    throw new TypeError(`Unsafe attribute: ${JSON.stringify(name)}`)
}

const serialize = (node: Node, onError?: (cause: Cause.Cause<unknown>) => void): string => {
  switch (node._tag) {
    case 'Text':
      return escape(node.text)
    case 'Fragment':
      return node.children.map((c) => serialize(c, onError)).join('')
    case 'Element': {
      checkName(TAG, 'tag', node.tag)
      const attrs = Object.entries(node.attrs)
        .map(([k, v]) => (checkAttr(k, v), ` ${k}="${escape(v)}"`))
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
