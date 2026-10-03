import { type Atom, type AtomStore, makeAtomStore } from '@sleekstack/core'
import { Cause, Effect, Exit, Fiber, type Layer, Scope } from 'effect'
import { Component, createElement, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { reportRenderError, runToNode } from './component'
import type { Node } from './node'
import { RenderScope, Store } from './reactive'
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
}
interface Instance extends Owner {
  host: HTMLElement
  rerun: Effect.Effect<Node>
  unsubs: Array<() => void>
  fiber: Fiber.RuntimeFiber<Node, unknown> | undefined
  queued: boolean
  dead: boolean
}
const owner = (): Owner => ({ roots: [], kids: [] })

const release = (o: Owner): void => {
  for (const kid of o.kids.splice(0)) kill(kid)
  for (const root of o.roots.splice(0)) root.unmount()
}
const kill = (i: Instance): void => {
  i.dead = true
  for (const u of i.unsubs.splice(0)) u()
  if (i.fiber) Effect.runFork(Fiber.interrupt(i.fiber))
  i.fiber = undefined
  release(i)
}

// Per-container generation token: a mount whose generation moved before it resolved writes nothing.
interface ContainerState {
  gen: number
  top: Owner
  close: () => void
}
const states = new WeakMap<Element, ContainerState>()

const teardown = (container: Element, state: ContainerState): void => {
  release(state.top)
  const close = state.close
  state.close = () => {}
  close()
  container.replaceChildren()
}

// Renderer state for one mount: who to report to, and subscriptions to start once the built subtree is committed.
interface Env {
  doc: Document
  store: AtomStore
  onError?: OnError
  live: () => boolean
  pending: Array<() => void>
}

const build = (node: Node, env: Env, o: Owner): globalThis.Node | null => {
  try {
    switch (node._tag) {
      case 'Text':
        return env.doc.createTextNode(node.text)
      case 'Fragment': {
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
        const inst: Instance = { ...owner(), host, rerun: node.rerun, unsubs: [], fiber: undefined, queued: false, dead: false }
        o.kids.push(inst)
        append(host, build(node.child, env, inst))
        env.pending.push(() => watch(inst, node.atoms, env))
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
    reportRenderError(error, env.onError)
    return null
  }
}

const append = (parent: globalThis.Node, child: globalThis.Node | null): void => {
  if (child) parent.appendChild(child)
}

const flush = (env: Env): void => {
  for (const start of env.pending.splice(0)) start()
}

const watch = (inst: Instance, atoms: ReadonlyArray<Atom.Atom<any>>, env: Env): void => {
  if (inst.dead) return
  // Changes in one tick (a store batch, or several atoms) coalesce into one re-run.
  const changed = () => {
    if (inst.queued) return
    inst.queued = true
    queueMicrotask(() => {
      inst.queued = false
      if (!inst.dead && env.live()) rerun(inst, env)
    })
  }
  for (const a of atoms) inst.unsubs.push(env.store.subscribe(a, changed))
}

// Latest wins: a newer change interrupts the in-flight re-run; only the current fiber of a live instance writes.
const rerun = (inst: Instance, env: Env): void => {
  if (inst.fiber) Effect.runFork(Fiber.interrupt(inst.fiber))
  const fiber = Effect.runFork(inst.rerun)
  inst.fiber = fiber
  fiber.addObserver((exit) => {
    if (inst.fiber !== fiber || inst.dead || !env.live()) return
    inst.fiber = undefined
    if (Exit.isSuccess(exit)) swap(inst, exit.value, env)
    else if (!Cause.isInterruptedOnly(exit.cause)) safeReport(exit.cause, env.onError)
  })
}

// One `replaceChildren`: the old subtree's guests and instances go first. A non-reactive result keeps the subscriptions.
const swap = (inst: Instance, node: Node, env: Env): void => {
  release(inst)
  const content = owner()
  const sub: Env = { ...env, pending: [] }
  const tree = build(node._tag === 'Reactive' ? node.child : node, sub, content)
  inst.roots = content.roots
  inst.kids = content.kids
  if (node._tag === 'Reactive') {
    for (const u of inst.unsubs.splice(0)) u()
    inst.rerun = node.rerun
    sub.pending.push(() => watch(inst, node.atoms, env))
  }
  inst.host.replaceChildren(...(tree ? [tree] : []))
  flush(sub)
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
  if (!state) states.set(container, (state = { gen: 0, top: owner(), close: () => {} }))
  const gen = ++state.gen
  const current = (): boolean => state.gen === gen
  const noop: Mounted = { dispose: async () => {} }
  // Re-mount clears the previous generation first, so a pending or rejecting mount orphans nothing.
  teardown(container, state)
  const store = opts.store ?? makeAtomStore()
  const scope = Effect.runSync(Scope.make())
  const close = () => {
    void Effect.runPromise(Scope.close(scope, Exit.void))
    if (!opts.store) void store.dispose()
  }
  state.close = close
  const provided = app.pipe(Effect.provideService(Store, store), Effect.provideService(RenderScope, scope)) as Effect.Effect<Node, E, Exclude<A, Store>>
  let node: Node
  try {
    node = await runToNode(provided, opts.layer, onError)
  } catch (error) {
    if (current()) teardown(container, state)
    throw error
  }
  if (!current()) return noop
  const top = owner()
  const env: Env = { doc: container.ownerDocument, store, onError, live: current, pending: [] }
  const tree = build(node, env, top)
  // Guest callbacks (`onError`) may start a newer mount while building.
  if (!current()) {
    release(top)
    return noop
  }
  state.top = top
  append(container, tree)
  flush(env)
  return {
    dispose: async () => {
      if (current()) teardown(container, state)
    },
  }
}
