import { type Atom, type AtomStore, makeAtomStore } from '@sleekstack/core'
import { Cause, Effect, Exit, Fiber, Layer, Scope } from 'effect'
import { Component, createElement, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { reportRenderError, runToNode } from './component'
import type { BindNode, ElementNode, EventBinding, FragmentNode, GuestNode, Node, ReactiveNode } from './node'
import {
  closeNow,
  commitSlots,
  disposeSlots,
  dropSlots,
  DuplicateKey,
  fallbacks,
  Frame,
  makeFrame,
  MountScope,
  RenderScope,
  type RunFrame,
  runScopes,
  Store,
} from './reactive'
import { checkAttr, checkTag } from './string'

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

// What one rendered node left on screen: its single DOM node and what a patch needs. Fragments are flattened away.
interface Live {
  readonly node: Exclude<Node, FragmentNode>
  readonly dom: ChildNode
  readonly kids: ReadonlyArray<Live>
  /** Effective key: absent when unkeyed or a later duplicate. */
  readonly key?: string
  readonly inst?: Instance
  readonly root?: Root
  /** An element's event state; shared by every Live of that element across patches. */
  readonly ev?: Events
  /** A `Bind` node's store subscription and atom hold; released when the node is dropped. */
  readonly off?: () => void
  /** An element's atom-valued attributes: shared by every Live of that element across patches. */
  readonly bnd?: BoundAttrs
}
interface BoundAttrs {
  atoms: Readonly<Record<string, Atom.Atom<any>>>
  off: () => void
}
// One direct listener per event name reads the current binding, so a patch swaps closures without re-listening.
interface Events {
  bindings: Readonly<Record<string, EventBinding>>
  readonly listeners: Map<string, (event: Event) => void>
  readonly fibers: Set<Fiber.RuntimeFiber<void, unknown>>
  dead: boolean
}
// The live children of a host (an instance's or the mount's) and the run scopes of its untracked components.
interface Owner {
  lives: Array<Live>
  scopes: Array<Scope.CloseableScope>
}
interface Instance extends Owner {
  host: HTMLElement
  rerun: Effect.Effect<Node>
  unsubs: Array<() => void>
  fiber: Fiber.RuntimeFiber<Node, unknown> | undefined
  // Epoch a re-run is queued for (-1: none); per epoch so a stale queue never blocks a newer subscription set.
  queued: number
  // Bumped by `unwatch`, so a change queued under an older subscription set is dropped.
  epoch: number
  dead: boolean
  // Scope of the run whose DOM is committed; closed when that DOM is replaced or dropped.
  scope: Scope.CloseableScope | undefined
  // Frame of the committed run: its slots are the instance's own.
  frame: RunFrame | undefined
  // The node whose run is committed; a parent that returns this same node did not re-run the instance.
  node: ReactiveNode
}

const closeScope = (scope: Scope.CloseableScope | undefined): void => {
  if (scope) closeNow(scope)
}
// Replaces a list of run scopes: closes the old ones except those the new list keeps (a reused row's scopes are in both).
const closeExcept = (old: ReadonlyArray<Scope.CloseableScope>, keep: ReadonlyArray<Scope.CloseableScope>): void => {
  if (old.length === 0) return
  if (keep.length === 0) return old.forEach(closeScope)
  const kept = new Set(keep)
  for (const s of old) if (!kept.has(s)) closeScope(s)
}
// Reactive nodes currently installed in the DOM: a discarded result that merely contains one (a reused row) must not close it.
const installed = new WeakSet<ReactiveNode>()

// Closes every run scope and drops the pending slots a never-built node owns (a discarded re-run result).
const dropScopes = (node: Node): void => {
  if (node._tag === 'Reactive') {
    if (installed.has(node)) return
    closeScope(node.scope)
    if (node.frame) dropSlots(node.frame)
    dropScopes(node.child)
  } else if (node._tag === 'Fragment' || node._tag === 'Element') {
    if (node._tag === 'Fragment') closeScope(runScopes.get(node))
    node.children.forEach(dropScopes)
  }
}

// Releases what a live subtree holds (instances, guest roots); its DOM is the caller's.
const drop = (l: Live): void => {
  if (l.inst) kill(l.inst)
  l.off?.()
  l.bnd?.off()
  if (l.root) l.root.unmount()
  if (l.ev) {
    l.ev.dead = true
    for (const f of l.ev.fibers) Effect.runFork(Fiber.interrupt(f))
    l.ev.fibers.clear()
  }
  l.kids.forEach(drop)
}
const release = (o: Owner): void => {
  o.lives.splice(0).forEach(drop)
  for (const scope of o.scopes.splice(0)) closeScope(scope)
}
const kill = (i: Instance): void => {
  i.dead = true
  unwatch(i)
  if (i.fiber) Effect.runFork(Fiber.interrupt(i.fiber))
  i.fiber = undefined
  release(i)
  closeScope(i.scope)
  i.scope = undefined
  if (i.frame) disposeSlots(i.frame.owner)
}

// Per-container generation token: a mount whose generation moved before it resolved writes nothing.
interface ContainerState {
  gen: number
  top: Owner
  close: () => Promise<void>
}
const states = new WeakMap<Element, ContainerState>()

const closed = async () => {}
// Synchronous DOM and subscription teardown; the returned promise settles once layers and an owned store are closed.
const teardown = (container: Element, state: ContainerState): Promise<void> => {
  // Detach `close` first: a guest unmount below may mount here and install its own.
  const close = state.close
  state.close = closed
  release(state.top)
  container.replaceChildren()
  return close()
}

// Renderer state for one patch. `defect` receives renderer failures (reported on first render; a re-run patch collects them).
interface Env {
  doc: Document
  store: AtomStore
  onError?: OnError
  live: () => boolean
  defect: (error: unknown) => void
  /** Reports `DuplicateKey`; once per patch. */
  duplicate: (key: string) => void
}

const once = (onError?: OnError) => {
  let reported = false
  return (key: string): void => {
    if (!reported) safeReport(Cause.fail(new DuplicateKey({ key })), onError)
    reported = true
  }
}

// Plan output: deferred infallible DOM ops, fresh lives (released if the plan is dropped), old lives to release on commit,
// and adoptions applied after them.
interface Plan {
  readonly ops: Array<() => void>
  readonly after: Array<() => void>
  readonly created: Array<Live>
  readonly dropped: Array<Live>
  readonly scopes: Array<Scope.CloseableScope>
}
const plan = (): Plan => ({ ops: [], after: [], created: [], dropped: [], scopes: [] })
const abort = (p: Plan): void => {
  p.created.forEach(drop)
  p.scopes.forEach(closeScope)
}
const commit = (p: Plan): void => {
  for (const op of p.ops) op()
  p.dropped.forEach(drop)
  for (const f of p.after) f()
}

type Leaf = Exclude<Node, FragmentNode>
const flat = (nodes: ReadonlyArray<Node>, scopes: Array<Scope.CloseableScope>, out: Array<Leaf> = []): Array<Leaf> => {
  for (const n of nodes) {
    if (n._tag !== 'Fragment') out.push(n)
    else {
      const scope = runScopes.get(n)
      if (scope) scopes.push(scope)
      flat(n.children, scopes, out)
    }
  }
  return out
}
// Children with no `Fragment` among them are their own leaves.
const leaves = (nodes: ReadonlyArray<Node>, scopes: Array<Scope.CloseableScope>): ReadonlyArray<Leaf> => {
  for (const n of nodes) if (n._tag === 'Fragment') return flat(nodes, scopes)
  return nodes as ReadonlyArray<Leaf>
}
// A repeated key reports `DuplicateKey` and the later sibling is unkeyed. `undefined`: no keyed node.
const keysOf = (nodes: ReadonlyArray<Leaf>, env: Env): Array<string | undefined> | undefined => {
  let seen: Set<string> | undefined
  let keys: Array<string | undefined> | undefined
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!
    const k = n._tag === 'Element' || n._tag === 'Reactive' || n._tag === 'Guest' ? n.key : undefined
    if (k === undefined) continue
    if (seen?.has(k)) {
      env.duplicate(k)
      continue
    }
    ;(seen ??= new Set()).add(k)
    ;(keys ??= new Array(nodes.length))[i] = k
  }
  return keys
}

const FORM = new Set(['INPUT', 'TEXTAREA', 'SELECT'])
// `value` / `checked` of form controls are live state: assigned as properties, only when they differ.
const setProp = (el: Element, k: string, v: string | undefined): void => {
  const f = el as HTMLInputElement
  if (k === 'value' && f.value !== (v ?? '')) f.value = v ?? ''
  if (k === 'checked' && f.checked !== (v !== undefined)) f.checked = v !== undefined
}

// An atom's value as an attribute: nullish and `false` drop it, `true` is empty, form `value`/`checked` also set the property.
const applyAttr = (el: Element, k: string, v: unknown): void => {
  const s = v == null || v === false ? undefined : v === true ? '' : String(v)
  if (s === undefined) el.removeAttribute(k)
  else {
    checkAttr(k, s)
    el.setAttribute(k, s)
  }
  if (FORM.has(el.tagName) && (k === 'value' || k === 'checked')) setProp(el, k, s)
}
// Sets each atom-valued attribute now and follows the atom without re-running anything; `off` releases the holds.
const bindAttrs = (el: Element, atoms: Readonly<Record<string, Atom.Atom<any>>>, env: Env, box: BoundAttrs): void => {
  const offs: Array<() => void> = []
  for (const [k, a] of Object.entries(atoms)) {
    applyAttr(el, k, read(env.store, a))
    const release = env.store.retain(a)
    const unsub = env.store.subscribe(a, () => applyAttr(el, k, read(env.store, a)))
    offs.push(unsub, release)
  }
  box.atoms = atoms
  box.off = () => offs.splice(0).forEach((f) => f())
}
const sameAtoms = (
  a: Readonly<Record<string, Atom.Atom<any>>> | undefined,
  b: Readonly<Record<string, Atom.Atom<any>>> | undefined,
): boolean => {
  const ka = a ? Object.keys(a) : []
  if (ka.length !== (b ? Object.keys(b).length : 0)) return false
  return ka.every((k) => b![k] === a![k])
}

// Sync throw, non-Effect return, failure or defect go to `onError`; fibers end with the element.
const dispatch = (ev: Events, name: string, event: Event, onError?: OnError): void => {
  const b = ev.bindings[name]
  if (!b || ev.dead) return
  let fiber: Fiber.RuntimeFiber<void, unknown>
  try {
    const eff = b.run(event)
    if (!Effect.isEffect(eff)) throw new TypeError(`on${name} handler did not return an Effect`)
    fiber = Effect.runFork(Effect.provide(eff, b.context))
  } catch (error) {
    return reportRenderError(error, onError)
  }
  ev.fibers.add(fiber)
  fiber.addObserver((exit) => {
    ev.fibers.delete(fiber)
    if (Exit.isFailure(exit) && !Cause.isInterruptedOnly(exit.cause)) safeReport(exit.cause, onError)
  })
}
const listen = (el: Element, ev: Events, names: Iterable<string>, onError?: OnError): void => {
  for (const name of names) {
    const f = (event: Event) => dispatch(ev, name, event, onError)
    ev.listeners.set(name, f)
    el.addEventListener(name, f)
  }
}
const relisten = (el: Element, ev: Events, next: Readonly<Record<string, EventBinding>>, onError?: OnError): void => {
  for (const [name, f] of ev.listeners)
    if (!Object.hasOwn(next, name)) (el.removeEventListener(name, f), ev.listeners.delete(name))
  ev.bindings = next
  listen(
    el,
    ev,
    Object.keys(next).filter((n) => !ev.listeners.has(n)),
    onError,
  )
}

// The boundary keeps its identity across renders, so a failed guest stays empty until unmounted.
const renderGuest = (root: Root, node: GuestNode, env: Env): void => {
  const report = (error: unknown) => reportRenderError(error, env.onError)
  flushSync(() => root.render(createElement(GuestBoundary, { report }, createElement(node.component, node.props))))
}

const build = (node: Leaf, key: string | undefined, env: Env, scopes: Array<Scope.CloseableScope>): Live | null => {
  try {
    const keyed = key === undefined ? {} : { key }
    switch (node._tag) {
      case 'Text':
        return { node, dom: env.doc.createTextNode(node.text), kids: [] }
      case 'Bind': {
        // Live on its own: the text follows the atom without re-running the enclosing component.
        const dom = env.doc.createTextNode(String(read(env.store, node.atom)))
        const release = env.store.retain(node.atom)
        const unsub = env.store.subscribe(node.atom, () => void (dom.nodeValue = String(read(env.store, node.atom))))
        return { node, dom, kids: [], off: () => (unsub(), release()) }
      }
      case 'Element': {
        const el = env.doc.createElement(checkTag(node.tag))
        for (const [k, v] of Object.entries(node.attrs)) {
          checkAttr(k, v)
          el.setAttribute(k, v)
        }
        const kids = buildAll(node.children, env, scopes, el)
        // After the options, so a `<select>` value finds its option.
        if (FORM.has(el.tagName))
          for (const k of ['value', 'checked']) if (Object.hasOwn(node.attrs, k)) setProp(el, k, node.attrs[k])
        const bnd: BoundAttrs | undefined = node.bound && { atoms: {}, off: () => {} }
        if (bnd) bindAttrs(el, node.bound!, env, bnd)
        if (!node.events) return { node, dom: el, kids, ...(bnd && { bnd }), ...keyed }
        const ev: Events = { bindings: node.events, listeners: new Map(), fibers: new Set(), dead: false }
        listen(el, ev, Object.keys(node.events), env.onError)
        return { node, dom: el, kids, ev, ...(bnd && { bnd }), ...keyed }
      }
      case 'Reactive': {
        const host = env.doc.createElement('sleek-reactive')
        host.style.display = 'contents'
        const inst: Instance = {
          lives: [],
          scopes: [],
          host,
          rerun: node.rerun,
          unsubs: [],
          fiber: undefined,
          queued: -1,
          epoch: 0,
          dead: false,
          scope: node.scope,
          frame: node.frame,
          node,
        }
        installed.add(node)
        inst.lives = buildAll([node.child], env, inst.scopes, host)
        watch(inst, node, env)
        return { node, dom: host, kids: [], inst, ...keyed }
      }
      case 'Guest': {
        // One React root per guest host; `display: contents` keeps the host out of layout.
        const host = env.doc.createElement('sleek-guest')
        host.style.display = 'contents'
        const root = createRoot(host, {
          onCaughtError: () => {},
          onUncaughtError: (error) => reportRenderError(error, env.onError),
        })
        const live: Live = { node, dom: host, kids: [], root, ...keyed }
        renderGuest(root, node, env)
        return live
      }
    }
  } catch (error) {
    env.defect(error)
    return null
  }
}
const buildAll = (
  nodes: ReadonlyArray<Node>,
  env: Env,
  scopes: Array<Scope.CloseableScope>,
  parent: globalThis.Node,
): Array<Live> => {
  const list = leaves(nodes, scopes)
  const keys = keysOf(list, env)
  return list.flatMap((n, i) => {
    const l = build(n, keys?.[i], env, scopes)
    if (!l) return []
    parent.appendChild(l.dom)
    return [l]
  })
}

// Plan phase for one element or text node matched in place: validates, reads the DOM, queues ops; mutates nothing.
const patch = (prev: Live, node: Leaf, key: string | undefined, env: Env, p: Plan): Live => {
  // The same node as the live one (a reused subtree): nodes are immutable, so there is nothing to patch.
  if (prev.node === node) return prev
  try {
    if (node._tag === 'Bind') return prev
    if (node._tag === 'Text') {
      if (prev.dom.nodeValue !== node.text) p.ops.push(() => void (prev.dom.nodeValue = node.text))
      return { node, dom: prev.dom, kids: [] }
    }
    const keyed = key === undefined ? {} : { key }
    if (node._tag === 'Guest') {
      // Same component: the root and its React state stay; only the props re-render on commit.
      const root = prev.root!
      p.ops.push(() => renderGuest(root, node, env))
      return { node, dom: prev.dom, kids: [], root, ...keyed }
    }
    const el = prev.dom as Element
    const old = (prev.node as ElementNode).attrs
    const next = (node as ElementNode).attrs
    let changed: Array<readonly [string, string | undefined]> | undefined
    for (const k in next) {
      const v = next[k]!
      if (old[k] !== v || !Object.hasOwn(old, k)) {
        checkAttr(k, v)
        ;(changed ??= []).push([k, v])
      }
    }
    for (const k in old) if (!Object.hasOwn(next, k)) (changed ??= []).push([k, undefined])
    if (changed) {
      const c = changed
      p.ops.push(() => c.forEach(([k, v]) => (v === undefined ? el.removeAttribute(k) : el.setAttribute(k, v))))
    }
    const kids = patchChildren(el, prev.kids, (node as ElementNode).children, env, p)
    const props = changed && FORM.has(el.tagName) ? changed.filter(([k]) => k === 'value' || k === 'checked') : []
    if (props.length > 0) p.ops.push(() => props.forEach(([k, v]) => setProp(el, k, v)))
    let bnd = prev.bnd
    const nextBound = (node as ElementNode).bound
    if (bnd || nextBound) {
      const box: BoundAttrs = (bnd ??= { atoms: {}, off: () => {} })
      if (!sameAtoms(box.atoms, nextBound)) {
        p.ops.push(() => {
          const old = box.atoms
          box.off()
          for (const k of Object.keys(old))
            if (!nextBound || !Object.hasOwn(nextBound, k)) if (!Object.hasOwn(next, k)) el.removeAttribute(k)
          if (nextBound) bindAttrs(el, nextBound, env, box)
          else box.atoms = {}
        })
      }
    }
    const events = (node as ElementNode).events
    let ev = prev.ev
    if (ev || (events && Object.keys(events).length > 0)) {
      const e = (ev ??= { bindings: {}, listeners: new Map(), fibers: new Set(), dead: false })
      const bindings = events ?? {}
      p.ops.push(() => relisten(el, e, bindings, env.onError))
    }
    return { node, dom: el, kids, ...(ev && { ev }), ...(bnd && { bnd }), ...keyed }
  } catch (error) {
    env.defect(error)
    return prev
  }
}

// A matched instance adopts the parent's fresh run: its subtree is planned now; rerun, subscriptions, scope and frame
// switch on commit, interrupting its own in-flight re-run. A dropped plan leaves it as is (the caller drops the node).
const adopt = (prev: Live, node: ReactiveNode, key: string | undefined, env: Env, p: Plan): Live => {
  const inst = prev.inst!
  const sub: Plan = { ...p, scopes: [] }
  const lives = patchChildren(inst.host, inst.lives, [node.child], env, sub)
  p.after.push(() => {
    if (inst.fiber) Effect.runFork(Fiber.interrupt(inst.fiber))
    inst.fiber = undefined
    inst.lives = lives
    closeExcept(inst.scopes.splice(0), sub.scopes)
    inst.scopes = sub.scopes
    unwatch(inst)
    const previous = inst.scope
    inst.rerun = node.rerun
    inst.scope = node.scope
    inst.frame = node.frame
    inst.node = node
    installed.add(node)
    watch(inst, node, env)
    if (previous !== node.scope) closeScope(previous)
    if (node.frame) commitSlots(node.frame)
  })
  return { node, dom: prev.dom, kids: [], inst, ...(key === undefined ? {} : { key }) }
}

const same = (a: Leaf, b: Leaf): boolean =>
  a._tag === b._tag &&
  (a._tag === 'Element'
    ? a.tag === (b as ElementNode).tag
    : a._tag === 'Bind'
      ? a.atom === (b as BindNode).atom
      : a._tag !== 'Guest' || a.component === (b as GuestNode).component)

// Matching: instances by id; others by key and type, else the next unkeyed old sibling by position (a separate pool).
const patchChildren = (
  parent: globalThis.Node,
  old: ReadonlyArray<Live>,
  nodes: ReadonlyArray<Node>,
  env: Env,
  p: Plan,
): Array<Live> => {
  const list = leaves(nodes, p.scopes)
  const keys = keysOf(list, env)
  let byKey: Map<string, Live> | undefined
  const pool: Array<Live> = []
  const gone: Array<Live> = []
  // ponytail: ids are unique per parent frame; ids repeated across flattened untracked siblings match in order.
  let byId: Map<string, Array<Live>> | undefined
  for (const l of old) {
    if (l.inst) {
      const id = (l.node as ReactiveNode).id
      const bucket = (byId ??= new Map()).get(id)
      if (bucket) bucket.push(l)
      else byId.set(id, [l])
    } else if (l.key !== undefined) (byKey ??= new Map()).set(l.key, l)
    else pool.push(l)
  }
  let next = 0
  const lives: Array<Live> = []
  for (let i = 0; i < list.length; i++) {
    const n = list[i]!
    const k = keys?.[i]
    let prev: Live | undefined
    if (n._tag === 'Reactive') {
      const m = byId?.get(n.id)?.shift()
      // The same node as the live one: a row that was not re-run (ADR 0020); nothing to adopt.
      if (m) {
        lives.push(m.inst!.node === n ? m : adopt(m, n, k, env, p))
        continue
      }
    } else if (k === undefined) prev = pool[next++]
    else {
      prev = byKey?.get(k)
      byKey?.delete(k)
    }
    if (prev && same(prev.node, n)) {
      lives.push(patch(prev, n, k, env, p))
      continue
    }
    if (prev) gone.push(prev)
    const l = build(n, k, env, p.scopes)
    if (!l) continue
    p.created.push(l)
    lives.push(l)
  }
  if (byKey) gone.push(...byKey.values())
  for (let i = next; i < pool.length; i++) gone.push(pool[i]!)
  if (byId) for (const rest of byId.values()) gone.push(...rest)
  if (gone.length > 0) p.dropped.push(...gone)
  // Same nodes in the same order and nothing removed: the DOM is already right.
  if (gone.length > 0 || !sameDoms(old, lives)) p.ops.push(() => place(parent, gone, lives))
  return lives
}

const sameDoms = (a: ReadonlyArray<Live>, b: ReadonlyArray<Live>): boolean => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i]!.dom !== b[i]!.dom) return false
  return true
}

// Apply: removes what went, then inserts or moves only nodes out of order (in-place runs stay); a displaced focus is restored.
const place = (parent: globalThis.Node, gone: ReadonlyArray<Live>, lives: ReadonlyArray<Live>): void => {
  for (const l of gone) l.dom.remove()
  // Already in order (the common case): nothing moves, so no focus to restore.
  let at = parent.firstChild
  let ordered = true
  for (const l of lives) {
    if (l.dom !== at) {
      ordered = false
      break
    }
    at = at.nextSibling
  }
  if (ordered) return
  const doc = parent.ownerDocument ?? (parent as Document)
  const focused = doc.activeElement as HTMLInputElement | null
  const sel = focused && parent.contains(focused) ? selection(focused) : undefined
  let cur = parent.firstChild
  for (const l of lives) {
    if (l.dom === cur) cur = cur.nextSibling
    else parent.insertBefore(l.dom, cur)
  }
  if (sel && doc.activeElement !== focused && focused!.isConnected) {
    focused!.focus()
    if (sel[0] !== null) focused!.setSelectionRange(sel[0], sel[1])
  }
}
// `selectionStart` throws on inputs without a selection (checkbox).
const selection = (el: HTMLInputElement): readonly [number | null, number | null] => {
  try {
    return [el.selectionStart ?? null, el.selectionEnd ?? null]
  } catch {
    return [null, null]
  }
}
// A value that moved between the run's read and this subscription (an async run, a guest commit) re-runs at once.
const watch = (inst: Instance, node: ReactiveNode, env: Env): void => {
  if (inst.dead) return
  // Changes in one tick (a store batch, or several atoms) coalesce into one re-run.
  const epoch = inst.epoch
  const changed = () => {
    if (inst.queued === epoch || inst.epoch !== epoch) return
    inst.queued = epoch
    queueMicrotask(() => {
      if (inst.queued === epoch) inst.queued = -1
      if (!inst.dead && inst.epoch === epoch && env.live()) rerun(inst, env)
    })
  }
  node.atoms.forEach((a, i) => {
    inst.unsubs.push(env.store.subscribe(a, changed))
    if (node.seen && !Object.is(read(env.store, a), node.seen[i])) changed()
  })
}
const read = (store: AtomStore, atom: Atom.Atom<any>): unknown => {
  try {
    return store.get(atom)
  } catch (error) {
    return error
  }
}

// Latest wins: a newer change interrupts the in-flight re-run; only the current fiber of a live instance writes.
const rerun = (inst: Instance, env: Env): void => {
  if (inst.fiber) Effect.runFork(Fiber.interrupt(inst.fiber))
  const fiber = Effect.runFork(inst.rerun)
  inst.fiber = fiber
  fiber.addObserver((exit) => {
    if (inst.fiber !== fiber || inst.dead || !env.live()) {
      if (Exit.isSuccess(exit)) dropScopes(exit.value)
      return
    }
    inst.fiber = undefined
    if (Exit.isSuccess(exit)) swap(inst, exit.value, env)
    else if (!Cause.isInterruptedOnly(exit.cause)) safeReport(exit.cause, env.onError)
  })
}

const unwatch = (inst: Instance): void => {
  inst.epoch++
  for (const u of inst.unsubs.splice(0)) u()
}

// Two-phase: plan the patch against the live tree aside; on a renderer defect or a supersede mid-plan keep the old DOM.
// A handled-error fallback is built as content and keeps the component's own subscriptions, so the next change retries.
const swap = (inst: Instance, node: Node, env: Env): void => {
  const errors: Array<unknown> = []
  const p = plan()
  const own = !fallbacks.has(node) && node._tag === 'Reactive' ? node : undefined
  const lives = patchChildren(
    inst.host,
    inst.lives,
    [own ? own.child : node],
    { ...env, defect: (e) => errors.push(e), duplicate: once(env.onError) },
    p,
  )
  if (errors.length > 0 || inst.dead || !env.live()) {
    abort(p)
    dropScopes(node)
    for (const e of errors) reportRenderError(e, env.onError)
    return
  }
  commit(p)
  inst.lives = lives
  closeExcept(inst.scopes.splice(0), p.scopes)
  inst.scopes = p.scopes
  const previous = inst.scope
  if (own) {
    unwatch(inst)
    inst.rerun = own.rerun
    inst.scope = own.scope
    inst.frame = own.frame
    inst.node = own
    installed.add(own)
    watch(inst, own, env)
    if (own.frame) commitSlots(own.frame)
  } else {
    // A fallback keeps the subscriptions (the next change retries); either way the replaced run's scope goes.
    if (!fallbacks.has(node)) unwatch(inst)
    inst.scope = undefined
  }
  if (inst.scope !== previous) closeScope(previous)
}

const safeReport = (cause: Cause.Cause<unknown>, onError?: OnError): void => {
  if (!onError) return console.error(cause)
  try {
    onError(cause)
  } catch (sinkError) {
    console.error(sinkError)
  }
}

/**
 * DOM renderer. Resolves once the tree and every guest root is committed into `container`.
 * A later `mount` on the same container wins; each handle disposes only its own generation.
 * Provides `Store` (`opts.store`, or a store it creates and disposes) and re-renders components that read atoms.
 */
export const mount = async <E, A, LE = never>(
  app: Effect.Effect<Node, E, A>,
  opts: { layer: Layer.Layer<Exclude<A, Store>, LE, never>; container: Element; onError?: OnError; store?: AtomStore },
): Promise<Mounted> => {
  const { container, onError } = opts
  let state = states.get(container)
  if (!state) states.set(container, (state = { gen: 0, top: { lives: [], scopes: [] }, close: closed }))
  const gen = ++state.gen
  const current = (): boolean => state.gen === gen
  const noop: Mounted = { dispose: async () => {} }
  // Re-mount clears the previous generation first, so a pending or rejecting mount orphans nothing.
  teardown(container, state).catch((e) => reportRenderError(e, onError))
  // A finalizer run by that teardown may itself have mounted here.
  if (!current()) return noop
  const store = opts.store ?? makeAtomStore()
  const scope = Effect.runSync(Scope.make())
  // Root frame: root-level instances get unique ids, and their slots go with the mount.
  const frame = makeFrame()
  state.close = async () => {
    try {
      frame.seen = undefined
      commitSlots(frame)
      await Effect.runPromise(Scope.close(scope, Exit.void))
    } finally {
      if (!opts.store) await store.dispose()
    }
  }
  const provided = app.pipe(
    Effect.provideService(Store, store),
    Effect.provideService(RenderScope, scope),
    Effect.provideService(MountScope, scope),
    Effect.provideService(Frame, frame),
  ) as Effect.Effect<Node, E, Exclude<A, Store>>
  let node: Node
  try {
    // The mount layer lives in the mount scope: re-runs reuse its services after the first render.
    node = await runToNode(provided, Layer.effectContext(Layer.buildWithScope(opts.layer, scope)), onError)
  } catch (error) {
    // Cleanup failures are reported; the render failure stays the rejection.
    if (current()) await teardown(container, state).catch((e) => reportRenderError(e, onError))
    throw error
  }
  if (!current()) return noop
  const p = plan()
  const env: Env = {
    doc: container.ownerDocument,
    store,
    onError,
    live: current,
    defect: (e) => reportRenderError(e, onError),
    duplicate: once(onError),
  }
  const lives = patchChildren(container, [], [node], env, p)
  // Guest callbacks (`onError`) may start a newer mount while building.
  if (!current()) {
    abort(p)
    return noop
  }
  commit(p)
  commitSlots(frame)
  state.top = { lives, scopes: p.scopes }
  return {
    dispose: async () => {
      if (current()) await teardown(container, state)
    },
  }
}
