import { Cause, Data, Effect, type Layer, Option, type Scope } from 'effect'
import { type AtomStore, hydrate } from '@sleekstack/core'
import { QueryClientTag } from '@sleekstack/query'
import { type DehydratedState, hydrate as hydrateQueries } from '@tanstack/query-core'
import { hydrateRoot } from 'react-dom/client'
import { reportRenderError } from './component'
import {
  build,
  mount,
  type Env,
  type Events,
  flat,
  guestElement,
  type Instance,
  keysOf,
  type Leaf,
  listen,
  type Live,
  type Mounted,
  owned,
  start,
  watch,
} from './dom'
import type { Node } from './node'
import { Store } from './reactive'
import { checkAttr, checkTag, TEXT_SEPARATOR } from './string'

/** `hydrateMount` on a container that a `mount` or `hydrateMount` already rendered into. */
export class HydrateConflict extends Data.TaggedError('HydrateConflict')<{ readonly container: Element }> {}

const SEPARATOR = TEXT_SEPARATOR.slice(4, -3)
const isSeparator = (d: ChildNode): boolean => d.nodeType === 8 && (d as Comment).data === SEPARATOR

/**
 * Server DOM that does not match the first client render (tag, text, instance or guest host, or extra server nodes).
 * Reported through `onError` once per replaced subtree; the subtree is rebuilt so the DOM equals a client render.
 * Parser-normalised markup (an inserted `<tbody>`, an auto-closed `<p>`) is not supported and surfaces as a mismatch.
 */
export class HydrationMismatch extends Data.TaggedError('HydrationMismatch')<{
  readonly expected: string
  readonly found: string
}> {}

/** The `data-sleek-hydrate` state script is not valid JSON or not a v1 payload; hydration falls back to client initial values. */
export class HydratePayloadInvalid extends Data.TaggedError('HydratePayloadInvalid')<{ readonly reason: string }> {}

type Payload = { atoms: Record<string, unknown>; queries?: DehydratedState }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

// Reads and removes the container's state script. Missing: nothing to seed. Malformed: reported, nothing seeded.
const readPayload = (container: Element, onError?: (cause: Cause.Cause<unknown>) => void): Payload | undefined => {
  const script = [...container.children].find((c) => c.matches('script[data-sleek-hydrate]'))
  if (!script) return undefined
  script.remove()
  try {
    const p: unknown = JSON.parse(script.textContent ?? '')
    if (!isRecord(p) || p.v !== 1 || !isRecord(p.atoms)) throw new Error('not a v1 payload')
    if (
      p.queries !== undefined &&
      !(isRecord(p.queries) && Array.isArray(p.queries.queries) && Array.isArray(p.queries.mutations))
    )
      throw new Error('queries is not a DehydratedState')
    return p as Payload
  } catch (error) {
    sink(
      Cause.fail(new HydratePayloadInvalid({ reason: error instanceof Error ? error.message : String(error) })),
      onError,
    )
    return undefined
  }
}

const sink = (cause: Cause.Cause<unknown>, onError?: (cause: Cause.Cause<unknown>) => void): void => {
  if (!onError) return console.error(cause)
  try {
    onError(cause)
  } catch (sinkError) {
    console.error(sinkError)
  }
}

// Seeds the store and the scope's QueryClient before the app's first run, so each component runs once with server state.
const seeded = <E, A>(app: Effect.Effect<Node, E, A>, p: Payload): Effect.Effect<Node, E, A | Store> =>
  Effect.flatMap(Store, (store) =>
    Effect.flatMap(Effect.serviceOption(QueryClientTag), (client) => {
      hydrate(store, p.atoms)
      if (p.queries && Option.isSome(client)) hydrateQueries(client.value, p.queries)
      return app
    }),
  )

const report = (env: Env, expected: string, found: ChildNode | string | undefined): void => {
  sink(
    Cause.fail(
      new HydrationMismatch({
        expected,
        found: typeof found === 'string' ? found : found ? found.nodeName : 'nothing',
      }),
    ),
    env.onError,
  )
}

const mismatch = (
  n: Leaf,
  key: string | undefined,
  dom: ChildNode | undefined,
  parent: globalThis.Node,
  env: Env,
  scopes: Array<Scope.CloseableScope>,
): Live | null => {
  report(env, n._tag === 'Element' ? `<${n.tag}>` : n._tag, dom)
  const l = build(n, key, env, scopes)
  if (l) parent.insertBefore(l.dom, dom ?? null)
  dom?.remove()
  return l
}

const textOf = (env: Env, n: Leaf): string =>
  n._tag === 'Text' ? n.text : n._tag === 'Bind' ? String(env.store.get(n.atom)) : ''

// One leaf against the DOM node at its position; null `dom` past the end. Creates DOM only on a mismatch or empty text.
const adoptOne = (
  n: Leaf,
  key: string | undefined,
  dom: ChildNode | undefined,
  parent: globalThis.Node,
  env: Env,
  scopes: Array<Scope.CloseableScope>,
): Live | null => {
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
        // An empty string serializes to no node at all (the parser never makes an empty text node).
        if (text === '' && !(d?.nodeType === 3 && d.nodeValue === '')) {
          const t = env.doc.createTextNode('')
          parent.insertBefore(t, d ?? null)
          return { node: n, dom: t, kids: [] }
        }
        if (d?.nodeType !== 3 || d.nodeValue !== text) return mismatch(n, key, d, parent, env, scopes)
        return { node: n, dom: d, kids: [] }
      }
      case 'Element': {
        if (dom?.nodeType !== 1 || (dom as Element).localName !== checkTag(n.tag).toLowerCase())
          return mismatch(n, key, dom, parent, env, scopes)
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
        const inst: Instance = {
          lives: [],
          scopes: [],
          host,
          node: n,
          rerun: n.rerun,
          unsubs: [],
          fiber: undefined,
          queued: -1,
          epoch: 0,
          dead: false,
          scope: n.scope,
          frame: n.frame,
        }
        inst.lives = adoptAll([n.child], host, env, inst.scopes)
        watch(inst, n, env)
        return { node: n, dom: host, kids: [], inst, ...keyed }
      }
      case 'Guest': {
        if (dom?.nodeName !== 'SLEEK-GUEST') return mismatch(n, key, dom, parent, env, scopes)
        // React adopts the server markup; content it cannot match it re-renders and reports here.
        const host = dom as HTMLElement
        const root = hydrateRoot(host, guestElement(n, env), {
          onCaughtError: () => {},
          onUncaughtError: (error) => reportRenderError(error, env.onError),
          onRecoverableError: (error) =>
            report(
              env,
              `guest ${n.component.displayName ?? n.component.name}`,
              `React: ${error instanceof Error ? error.message : String(error)}`,
            ),
        })
        return { node: n, dom: host, kids: [], root, ...keyed }
      }
    }
  } catch (error) {
    env.defect(error)
    return null
  }
}

const adoptAll = (
  nodes: ReadonlyArray<Node>,
  parent: globalThis.Node,
  env: Env,
  scopes: Array<Scope.CloseableScope>,
): Array<Live> => {
  for (const d of [...parent.childNodes]) if (isSeparator(d)) d.remove()
  const list = flat(nodes, scopes)
  const keys = keysOf(list, env)
  const lives: Array<Live> = []
  let dom = parent.firstChild ?? undefined
  list.forEach((n, i) => {
    const l = adoptOne(n, keys?.[i], dom, parent, env, scopes)
    if (!l) return
    lives.push(l)
    dom = l.dom.nextSibling ?? undefined
  })
  // Extra server nodes go, reported once; a resume manifest is ignored silently (hydration and resume are exclusive).
  let reported = false
  while (dom) {
    const next = dom.nextSibling ?? undefined
    if (!reported && !(dom.nodeType === 1 && (dom as Element).matches('script[data-sleek-manifest]'))) {
      report(env, 'nothing', dom)
      reported = true
    }
    dom.remove()
    dom = next
  }
  return lives
}

/**
 * Hydrates server markup from `renderToString` in `container`: runs the app once and adopts the existing DOM
 * (listeners, `useLocal` slots and subscriptions attach; matching nodes are kept). Same options, `onError` and
 * dispose as `mount`; a later `mount` on the container replaces it. Rejects with `HydrateConflict` when the container
 * was already mounted or hydrated. The `data-sleek-hydrate` state script seeds the store (also a given `opts.store`)
 * and the layer's QueryClient before the first run; a malformed one is reported as `HydratePayloadInvalid` and the
 * app starts from client initial values.
 */
export const hydrateMount = async <E, A, LE = never>(
  app: Effect.Effect<Node, E, A>,
  opts: {
    layer: Layer.Layer<Exclude<A, Store>, LE, never>
    container: Element
    onError?: (cause: Cause.Cause<unknown>) => void
    store?: AtomStore
  },
): Promise<Mounted> => {
  if (owned(opts.container)) throw new HydrateConflict({ container: opts.container })
  const p = readPayload(opts.container, opts.onError)
  if (p) app = seeded(app, p) as typeof app
  let broken = false
  const h = await start(app, opts, (container, node, env, scopes) =>
    adoptAll([node], container, { ...env, defect: (e) => ((broken = true), env.defect(e)) }, scopes),
  )
  if (!broken) return h
  // A renderer defect mid-walk leaves the adopted tree untrustworthy: fall back to a full client render.
  await h.dispose()
  return mount(app, opts)
}
