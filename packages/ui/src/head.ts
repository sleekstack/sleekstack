import { Effect, Scope } from 'effect'
import { type Child, Fragment } from './jsx-runtime'
import { type ElementNode, fragment, type Node } from './node'
import { Frame, RenderScope } from './reactive'
import { checkAttr, checkTag } from './string'
import { HeadSink } from './headsink'

const TAGS = new Set(['title', 'meta', 'link'])

// The head tags a `<Head>`'s children built, checked like elements; anything else is a defect of the page.
const tags = (node: Node, out: Array<ElementNode> = []): Array<ElementNode> => {
  if (node._tag === 'Fragment') for (const c of node.children) tags(c, out)
  else if (node._tag === 'Element' && TAGS.has(checkTag(node.tag))) {
    for (const [k, v] of Object.entries(node.attrs)) checkAttr(k, v)
    if (node.on || node.events || node.bound || node.ref)
      throw new TypeError(`<${node.tag}> in <Head> takes plain attributes only`)
    if (node.children.some((c) => c._tag !== 'Text' || node.tag !== 'title'))
      throw new TypeError(node.tag === 'title' ? '<title> takes text only' : `<${node.tag}> takes no children`)
    out.push(node)
  } else throw new TypeError('<Head> takes title, meta and link elements only')
  return out
}

/**
 * `<Head><title>…</title><meta name=… content=… /><link rel=… href=… /></Head>`: sets those tags in the document head.
 * Tags dedupe by key (`title`, `meta[name]`, `meta[property]`, `link[rel]+href`); the deepest `Head` wins; a component's
 * tags go when it unmounts. `renderToString` returns them through its `onHead` option; `mount` patches `document.head`.
 */
export const Head = (props: { children?: Child }): Effect.Effect<Node> =>
  Effect.flatMap(Effect.all([Fragment(props), HeadSink, Frame, RenderScope]), ([node, sink, frame, scope]) => {
    const remove = sink.add(tags(node), frame?.depth ?? 0)
    return Effect.as(scope ? Scope.addFinalizer(scope, Effect.sync(remove)) : Effect.void, fragment())
  }) as Effect.Effect<Node>
