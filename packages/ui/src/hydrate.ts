import { Cause, Data, Effect, Exit, type Layer, Option, type Scope } from 'effect'
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
  guestElement,
  type Instance,
  keysOf,
  type Leaf,
  listen,
  type Live,
  type Mounted,
  owned,
  release,
  start,
  watch,
} from './dom'
import type { Node } from './node'
import type { HydratingCell, Late } from './pending'
import { runScopes, Store } from './reactive'
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

/** A streamed boundary's chunk never arrived (the stream ended without it); its fallback stays on screen. */
export class BoundaryChunkMissing extends Data.TaggedError('BoundaryChunkMissing')<{ readonly id: string }> {}

type Payload = { atoms: Record<string, unknown>; queries?: DehydratedState; b?: Record<string, string> }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

// Reads and removes the container's state scripts (a stream writes one per flush), merged in order. Missing: nothing
// to seed. Malformed: reported and skipped.
const readPayload = (container: Element, onError?: (cause: Cause.Cause<unknown>) => void): Payload | undefined => {
  const scripts = [...container.children].filter((c) => c.matches('script[data-sleek-hydrate]'))
  let out: Payload | undefined
  for (const script of scripts) {
    script.remove()
    try {
      const p: unknown = JSON.parse(script.textContent ?? '')
      if (!isRecord(p) || p.v !== 1 || !isRecord(p.atoms)) throw new Error('not a v1 payload')
      if (
        p.queries !== undefined &&
        !(isRecord(p.queries) && Array.isArray(p.queries.queries) && Array.isArray(p.queries.mutations))
      )
        throw new Error('queries is not a DehydratedState')
      if (p.b !== undefined && !(isRecord(p.b) && Object.values(p.b).every((v) => typeof v === 'string')))
        throw new Error('b is not a boundary map')
      const q = (p as Payload).queries
      out = {
        b: { ...out?.b, ...(p as Payload).b },
        atoms: Object.assign(Object.create(null), out?.atoms, p.atoms),
        queries:
          out?.queries && q
            ? { queries: [...out.queries.queries, ...q.queries], mutations: [...out.queries.mutations, ...q.mutations] }
            : (q ?? out?.queries),
      }
    } catch (error) {
      sink(
        Cause.fail(new HydratePayloadInvalid({ reason: error instanceof Error ? error.message : String(error) })),
        onError,
      )
    }
  }
  return out
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
const seed = (p: Payload | undefined): Effect.Effect<void, never, Store> =>
  Effect.flatMap(Store, (store) =>
    Effect.map(Effect.serviceOption(QueryClientTag), (client) => {
      if (!p) return
      hydrate(store, p.atoms)
      if (p.queries && Option.isSome(client)) hydrateQueries(client.value, p.queries)
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

// A late boundary's fallback as adopted: its lives sit in `lives` (an owner's array) from `from`, between the placeholder
// comments `open` and `close`, until the chunk lands.
interface Mark {
  readonly late: Late
  readonly lives: Array<Live>
  readonly scopes: Array<Scope.CloseableScope>
  from: number
  fallback: Array<Live>
  open?: ChildNode
  close?: ChildNode
}
type StreamEnv = Env & { deferred?: WeakMap<Node, Late>; marks?: Map<string, Mark> }

// `flat`, also recording the leaf range of each late Pending's fallback.
const flatMarked = (
  nodes: ReadonlyArray<Node>,
  scopes: Array<Scope.CloseableScope>,
  env: StreamEnv,
  out: Array<Leaf>,
  groups: Array<[Late, number, number]>,
): Array<Leaf> => {
  for (const n of nodes) {
    if (n._tag !== 'Fragment') {
      out.push(n)
      continue
    }
    const scope = runScopes.get(n)
    if (scope) scopes.push(scope)
    const start = out.length
    flatMarked(n.children, scopes, env, out, groups)
    const late = env.deferred?.get(n)
    if (late) groups.push([late, start, out.length])
  }
  return out
}

const isComment = (d: ChildNode | undefined, data: string): boolean => d?.nodeType === 8 && (d as Comment).data === data

const adoptAll = (
  nodes: ReadonlyArray<Node>,
  parent: globalThis.Node,
  env: StreamEnv,
  scopes: Array<Scope.CloseableScope>,
): Array<Live> => {
  for (const d of [...parent.childNodes]) if (isSeparator(d)) d.remove()
  const groups: Array<[Late, number, number]> = []
  const list = flatMarked(nodes, scopes, env, [], groups)
  groups.sort((a, b) => a[1] - b[1])
  const keys = keysOf(list, env)
  const lives: Array<Live> = []
  let dom = parent.firstChild ?? undefined
  let open: [Mark, number] | undefined
  let g = 0
  // A late fallback sits between `<!--sleek-p:ID-->` and `<!--/sleek-p-->`: the comments stay for the swap, the walk skips them.
  const close = () => {
    const [m] = open!
    m.fallback = lives.slice(m.from)
    if (isComment(dom, '/sleek-p')) ((m.close = dom), (dom = dom!.nextSibling ?? undefined))
    open = undefined
  }
  for (let i = 0; ; i++) {
    if (open && open[1] === i) close()
    while (g < groups.length && groups[g]![1] === i) {
      const [late, , end] = groups[g++]!
      const m: Mark = { late, lives, scopes, from: lives.length, fallback: [] }
      env.marks?.set(late.id, m)
      if (isComment(dom, `sleek-p:${late.id}`)) ((m.open = dom), (dom = dom!.nextSibling ?? undefined))
      open = [m, end]
      if (end === i) close()
    }
    if (i === list.length) break
    const l = adoptOne(list[i]!, keys?.[i], dom, parent, env, scopes)
    if (!l) continue
    lives.push(l)
    dom = l.dom.nextSibling ?? undefined
  }
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
  const { container, onError } = opts
  if (owned(container)) throw new HydrateConflict({ container })
  const p = readPayload(container, onError)
  if (p) app = Effect.zipRight(seed(p), app) as typeof app
  // Mid-stream: boundaries whose placeholder is still on screen hydrate their fallback and adopt the content on landing.
  const late = new Map<string, string>()
  const onScreen = placeholders(container)
  for (const [id, path] of Object.entries(p?.b ?? {})) if (onScreen.has(id)) late.set(path, id)
  let broken = false
  let env: StreamEnv | undefined
  const marks = new Map<string, Mark>()
  const cell: HydratingCell = { on: true, late, counts: new Map(), deferred: new WeakMap() }
  const stop = late.size > 0 ? landing(container, new Set(late.values()), marks, cell, () => env, onError) : undefined
  let h: Mounted
  try {
    h = await start(
      app,
      opts,
      (c, node, e, scopes) =>
        adoptAll(
          [node],
          c,
          (env = { ...e, defect: (x) => ((broken = true), e.defect(x)), deferred: cell.deferred, marks }),
          scopes,
        ),
      cell,
    )
  } catch (error) {
    stop?.(true)
    throw error
  }
  if (!broken) {
    stop?.(false)
    return stop ? { dispose: () => (stop(true), h.dispose()) } : h
  }
  // A renderer defect mid-walk leaves the adopted tree untrustworthy: fall back to a full client render.
  stop?.(true)
  await h.dispose()
  return mount(app, opts)
}

const placeholders = (root: globalThis.Node): Set<string> => {
  const ids = new Set<string>()
  const walk = (root.ownerDocument ?? (root as Document)).createTreeWalker(root, 128)
  for (let n = walk.nextNode(); n; n = walk.nextNode())
    if ((n as Comment).data.startsWith('sleek-p:')) ids.add((n as Comment).data.slice(8))
  return ids
}

type Swap = {
  __sleekSwap?: (id: string) => void
  __sleekEnd?: (ids: ReadonlyArray<string>) => void
  __sleekGone?: ReadonlyArray<string>
}

/**
 * Takes over the stream's swap for `ids`: a landing chunk swaps as usual, its state is seeded and the content runs
 * hydrating, then adopts the swapped DOM in place of the fallback. Landings run one at a time and wait for the walk, so
 * a nested chunk adopts after its parent. A chunk for an adopted boundary is ignored; one the stream ended without is
 * reported as `BoundaryChunkMissing`. Returns `stop(dead)`: the walk is done (flush), or the hydration is gone.
 */
const landing = (
  container: Element,
  ids: Set<string>,
  marks: Map<string, Mark>,
  cell: HydratingCell,
  env: () => StreamEnv | undefined,
  onError?: (cause: Cause.Cause<unknown>) => void,
) => {
  // ponytail: one page-global hook chain; a later stream's shell redefines `__sleekSwap` and bypasses it.
  const g = globalThis as Swap
  const swap = g.__sleekSwap
  const end = g.__sleekEnd
  let dead = false
  let busy = 1
  const queue: Array<string> = []
  const gone = (id: string) => ids.delete(id) && sink(Cause.fail(new BoundaryChunkMissing({ id })), onError)
  const flush = () => {
    while (!busy && queue.length) void land(queue.shift()!)
  }
  const land = async (id: string): Promise<void> => {
    const m = marks.get(id)
    const e = env()
    if (!ids.delete(id) || dead || !m?.open || !m.close || !e?.live()) return swap?.(id)
    const t = container.querySelector(`template[data-sleek-b="${id}"]`) as HTMLTemplateElement | null
    const state = readPayload(container, onError)
    // Boundaries nested in this chunk land through here too, after this one is adopted.
    const nested = t ? placeholders(t.content) : new Set<string>()
    for (const [n, path] of Object.entries(state?.b ?? {})) if (nested.has(n)) (ids.add(n), cell.late!.set(path, n))
    const parent = m.open.parentNode!
    const anchor = m.close.nextSibling
    const nodes = t ? [...t.content.childNodes] : []
    swap?.(id)
    busy++
    try {
      const exit = await m.late.land(seed(state))
      const idx = m.fallback.length ? m.lives.indexOf(m.fallback[0]!) : m.from
      if (Exit.isFailure(exit)) return void (Cause.isInterruptedOnly(exit.cause) || sink(exit.cause, onError))
      if (!exit.value || idx < 0 || dead || !e.live()) return
      // Adopted aside, so the walk sees only the chunk's nodes, then put back where the swap left them.
      const frag = e.doc.createDocumentFragment()
      frag.append(...nodes)
      const lives = adoptAll([exit.value], frag, e, m.scopes)
      parent.insertBefore(frag, anchor)
      m.lives.splice(idx, m.fallback.length, ...lives)
      release({ lives: m.fallback, scopes: [] })
    } finally {
      busy--
      flush()
    }
  }
  g.__sleekSwap = (id) => (dead || !ids.has(id) ? swap?.(id) : (queue.push(id), flush()))
  g.__sleekEnd = (m) => (end?.(m), dead || m.forEach(gone))
  return (stop: boolean) => {
    if (stop) return void (dead = true)
    g.__sleekGone?.forEach(gone)
    busy--
    flush()
  }
}
