import { type Atom, type AtomStore, makeAtomStore } from '@sleekstack/core'
import { Cause, Effect, Exit, Fiber, Layer, Scope } from 'effect'
import { Component, createElement, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { reportRenderError, runToNode } from './component'
import type { Node, ReactiveNode } from './node'
import { fallbacks, RenderScope, runScopes, Store } from './reactive'
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

// Guest roots and reactive instances created inside one subtree; released together when it goes.
interface Owner {
  roots: Array<Root>
  kids: Array<Instance>
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
}
const owner = (): Owner => ({ roots: [], kids: [], scopes: [] })

const closeScope = (scope: Scope.CloseableScope | undefined): void => {
  if (scope) Effect.runFork(Scope.close(scope, Exit.void))
}

// Closes every run scope a never-built node owns (a discarded re-run result).
const dropScopes = (node: Node): void => {
  if (node._tag === 'Reactive') {
    closeScope(node.scope)
    dropScopes(node.child)
  } else if (node._tag === 'Fragment' || node._tag === 'Element') {
    if (node._tag === 'Fragment') closeScope(runScopes.get(node))
    node.children.forEach(dropScopes)
  }
}

const release = (o: Owner): void => {
  for (const kid of o.kids.splice(0)) kill(kid)
  for (const root of o.roots.splice(0)) root.unmount()
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

// Renderer state for one mount. `defect` receives renderer failures (reported on first render; a re-run swap collects them).
interface Env {
  doc: Document
  store: AtomStore
  onError?: OnError
  live: () => boolean
  defect: (error: unknown) => void
}

const build = (node: Node, env: Env, o: Owner): globalThis.Node | null => {
  try {
    switch (node._tag) {
      case 'Text':
        return env.doc.createTextNode(node.text)
      case 'Fragment': {
        const scope = runScopes.get(node)
        if (scope) o.scopes.push(scope)
        const frag = env.doc.createDocumentFragment()
        for (const c of node.children) append(frag, build(c, env, o))
        return frag
      }
      case 'Element': {
        const el = env.doc.createElement(checkTag(node.tag))
        for (const [k, v] of Object.entries(node.attrs)) {
          checkAttr(k, v)
          el.setAttribute(k, v)
        }
        for (const c of node.children) append(el, build(c, env, o))
        return el
      }
      case 'Reactive': {
        const host = env.doc.createElement('sleek-reactive')
        host.style.display = 'contents'
        const inst: Instance = { ...owner(), host, rerun: node.rerun, unsubs: [], fiber: undefined, queued: -1, epoch: 0, dead: false, scope: node.scope }
        o.kids.push(inst)
        append(host, build(node.child, env, inst))
        watch(inst, node, env)
        return host
      }
      case 'Guest': {
        // One React root per guest host; `display: contents` keeps the host out of layout.
        const host = env.doc.createElement('sleek-guest')
        host.style.display = 'contents'
        const report = (error: unknown) => reportRenderError(error, env.onError)
        const root = createRoot(host, { onCaughtError: () => {}, onUncaughtError: report })
        o.roots.push(root)
        flushSync(() => root.render(createElement(GuestBoundary, { report }, createElement(node.component, node.props))))
        return host
      }
    }
  } catch (error) {
    env.defect(error)
    return null
  }
}

const append = (parent: globalThis.Node, child: globalThis.Node | null): void => {
  if (child) parent.appendChild(child)
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

// Transactional: build the new subtree aside; on a renderer defect or a supersede mid-build keep the old DOM.
// A handled-error fallback is built as content and keeps the component's own subscriptions, so the next change retries.
const swap = (inst: Instance, node: Node, env: Env): void => {
  const errors: Array<unknown> = []
  const content = owner()
  const own = !fallbacks.has(node) && node._tag === 'Reactive' ? node : undefined
  const tree = build(own ? own.child : node, { ...env, defect: (e) => errors.push(e) }, content)
  if (errors.length > 0 || inst.dead || !env.live()) {
    release(content)
    dropScopes(node)
    for (const e of errors) reportRenderError(e, env.onError)
    return
  }
  release(inst)
  inst.roots = content.roots
  inst.kids = content.kids
  inst.scopes = content.scopes
  const previous = inst.scope
  if (own) {
    unwatch(inst)
    inst.rerun = own.rerun
    inst.scope = own.scope
    watch(inst, own, env)
  } else {
    // A fallback keeps the subscriptions (the next change retries); either way the replaced run's scope goes.
    if (!fallbacks.has(node)) unwatch(inst)
    inst.scope = undefined
  }
  inst.host.replaceChildren(...(tree ? [tree] : []))
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
  if (!state) states.set(container, (state = { gen: 0, top: owner(), close: closed }))
  const gen = ++state.gen
  const current = (): boolean => state.gen === gen
  const noop: Mounted = { dispose: async () => {} }
  // Re-mount clears the previous generation first, so a pending or rejecting mount orphans nothing.
  teardown(container, state).catch((e) => reportRenderError(e, onError))
  // A finalizer run by that teardown may itself have mounted here.
  if (!current()) return noop
  const store = opts.store ?? makeAtomStore()
  const scope = Effect.runSync(Scope.make())
  state.close = async () => {
    try {
      await Effect.runPromise(Scope.close(scope, Exit.void))
    } finally {
      if (!opts.store) await store.dispose()
    }
  }
  const provided = app.pipe(Effect.provideService(Store, store), Effect.provideService(RenderScope, scope)) as Effect.Effect<Node, E, Exclude<A, Store>>
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
  const top = owner()
  const env: Env = { doc: container.ownerDocument, store, onError, live: current, defect: (e) => reportRenderError(e, onError) }
  const tree = build(node, env, top)
  // Guest callbacks (`onError`) may start a newer mount while building.
  if (!current()) {
    release(top)
    return noop
  }
  state.top = top
  append(container, tree)
  return {
    dispose: async () => {
      if (current()) await teardown(container, state)
    },
  }
}
