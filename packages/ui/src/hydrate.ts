import { Data, type Cause, type Effect, type Layer, type Scope } from 'effect'
import type { AtomStore } from '@sleekstack/core'
import { createRoot } from 'react-dom/client'
import { reportRenderError } from './component'
import { build, type Env, type Events, flat, type Instance, keysOf, type Leaf, listen, type Live, type Mounted, owned, renderGuest, start, watch } from './dom'
import type { Node } from './node'
import type { Store } from './reactive'
import { checkAttr, checkTag, TEXT_SEPARATOR } from './string'

/** `hydrateMount` on a container that a `mount` or `hydrateMount` already rendered into. */
export class HydrateConflict extends Data.TaggedError('HydrateConflict')<{ readonly container: Element }> {}

const SEPARATOR = TEXT_SEPARATOR.slice(4, -3)
const isSeparator = (d: ChildNode): boolean => d.nodeType === 8 && (d as Comment).data === SEPARATOR

// ponytail: a mismatch replaces just that node with a fresh build and reports a defect; fn-25.3 owns the real policy.
const mismatch = (n: Leaf, key: string | undefined, dom: ChildNode | undefined, parent: globalThis.Node, env: Env, scopes: Array<Scope.CloseableScope>): Live | null => {
  env.defect(new Error(`Hydration mismatch: expected ${n._tag === 'Element' ? `<${n.tag}>` : n._tag}, found ${dom ? dom.nodeName : 'nothing'}`))
  const l = build(n, key, env, scopes)
  if (l) parent.insertBefore(l.dom, dom ?? null)
  dom?.remove()
  return l
}

const textOf = (env: Env, n: Leaf): string => (n._tag === 'Text' ? n.text : n._tag === 'Bind' ? String(env.store.get(n.atom)) : '')

// One leaf against the DOM node at its position; null `dom` past the end. Creates DOM only on a mismatch or empty text.
const adoptOne = (n: Leaf, key: string | undefined, dom: ChildNode | undefined, parent: globalThis.Node, env: Env, scopes: Array<Scope.CloseableScope>): Live | null => {
  try {
    const keyed = key === undefined ? {} : { key }
    switch (n._tag) {
      case 'Text':
      case 'Bind': {
        const text = textOf(env, n)
        // `sleek-bind` is resume markup; hydration unwraps it to its text node (hydration and resume are exclusive).
        let d = dom
        if (n._tag === 'Bind' && d?.nodeName === 'SLEEK-BIND') {
          const inner = d.firstChild ?? env.doc.createTextNode('')
          d.replaceWith(inner)
          d = inner
        }
        // An empty string serializes to no node at all.
        if (text === '' && d?.nodeType !== 3) {
          const t = env.doc.createTextNode('')
          parent.insertBefore(t, d ?? null)
          return { node: n, dom: t, kids: [] }
        }
        if (d?.nodeType !== 3 || d.nodeValue !== text) return mismatch(n, key, d, parent, env, scopes)
        return { node: n, dom: d, kids: [] }
      }
      case 'Element': {
        if (dom?.nodeType !== 1 || (dom as Element).localName !== checkTag(n.tag).toLowerCase()) return mismatch(n, key, dom, parent, env, scopes)
        const el = dom as Element
        for (const [k, v] of Object.entries(n.attrs)) checkAttr(k, v)
        // Attributes and form `value` / `checked` are left as the server (or the user) left them.
        const kids = adoptAll(n.children, el, env, scopes)
        if (!n.events) return { node: n, dom: el, kids, ...keyed }
        const ev: Events = { bindings: n.events, listeners: new Map(), fibers: new Set(), dead: false }
        listen(el, ev, Object.keys(n.events), env.onError)
        return { node: n, dom: el, kids, ev, ...keyed }
      }
      case 'Reactive': {
        if (dom?.nodeName !== 'SLEEK-REACTIVE') return mismatch(n, key, dom, parent, env, scopes)
        const host = dom as HTMLElement
        const inst: Instance = { lives: [], scopes: [], host, rerun: n.rerun, unsubs: [], fiber: undefined, queued: -1, epoch: 0, dead: false, scope: n.scope, frame: n.frame }
        inst.lives = adoptAll([n.child], host, env, inst.scopes)
        watch(inst, n, env)
        return { node: n, dom: host, kids: [], inst, ...keyed }
      }
      case 'Guest': {
        if (dom?.nodeName !== 'SLEEK-GUEST') return mismatch(n, key, dom, parent, env, scopes)
        // ponytail: the host is kept but React re-renders its content; fn-25.5 switches to `hydrateRoot`.
        const host = dom as HTMLElement
        const root = createRoot(host, { onCaughtError: () => {}, onUncaughtError: (error) => reportRenderError(error, env.onError) })
        renderGuest(root, n, env)
        return { node: n, dom: host, kids: [], root, ...keyed }
      }
    }
  } catch (error) {
    env.defect(error)
    return null
  }
}

const adoptAll = (nodes: ReadonlyArray<Node>, parent: globalThis.Node, env: Env, scopes: Array<Scope.CloseableScope>): Array<Live> => {
  for (const d of [...parent.childNodes]) if (isSeparator(d)) d.remove()
  const list = flat(nodes, scopes)
  const keys = keysOf(list, env)
  const lives: Array<Live> = []
  let dom = parent.firstChild ?? undefined
  list.forEach((n, i) => {
    const l = adoptOne(n, keys[i], dom, parent, env, scopes)
    if (!l) return
    lives.push(l)
    dom = l.dom.nextSibling ?? undefined
  })
  // ponytail: extra server nodes are dropped silently; fn-25.3 reports them as a mismatch.
  while (dom) {
    const next = dom.nextSibling ?? undefined
    dom.remove()
    dom = next
  }
  return lives
}

/**
 * Hydrates server markup from `renderToString` in `container`: runs the app once and adopts the existing DOM
 * (listeners, `useLocal` slots and subscriptions attach; matching nodes are kept). Same options, `onError` and
 * dispose as `mount`; a later `mount` on the container replaces it. Rejects with `HydrateConflict` when the container
 * was already mounted or hydrated.
 */
export const hydrateMount = async <E, A, LE = never>(
  app: Effect.Effect<Node, E, A>,
  opts: { layer: Layer.Layer<Exclude<A, Store>, LE, never>; container: Element; onError?: (cause: Cause.Cause<unknown>) => void; store?: AtomStore },
): Promise<Mounted> => {
  if (owned(opts.container)) throw new HydrateConflict({ container: opts.container })
  return start(app, opts, (container, node, env, scopes) => adoptAll([node], container, env, scopes))
}
