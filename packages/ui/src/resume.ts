import { Atom, makeAtomStore } from '@sleekstack/core'
import { Cause, Context, Data, Effect, Exit, Fiber, Layer, Option, Schema, Scope } from 'effect'
import type { Handler, HandlerEvent } from './handler'
import { Store } from './reactive'

export class ManifestInvalid extends Data.TaggedError('ManifestInvalid')<{ readonly reason: string }> {}
export class ManifestDecodeFailed extends Data.TaggedError('ManifestDecodeFailed')<{ readonly key: string; readonly cause?: unknown }> {}
export class UnknownHandler extends Data.TaggedError('UnknownHandler')<{ readonly id: string }> {}
export class HandlerIdMismatch extends Data.TaggedError('HandlerIdMismatch')<{ readonly key: string; readonly id: string }> {}

export type HandlerLoader<R> = () => Promise<{ readonly default: Handler<any, R> }>
export interface Resumed {
  readonly dispose: () => Promise<void>
}
export interface ResumeOptions<R, LE> {
  readonly container: Element
  readonly layer: Layer.Layer<Exclude<R, Store>, LE, never>
  readonly handlers: Readonly<Record<string, HandlerLoader<R>>>
  /** Manifest key to its atom. Seeded with `store.set`, so each must be a writable whose write stores the value (`Atom.make(v)`); derived atoms are rejected. */
  readonly atoms: Readonly<Record<string, Atom.Writable<any, any>>>
  readonly onError?: (cause: Cause.Cause<unknown>) => void
}

// One activation per container; the entry is removed on rejection and on dispose.
const activations = new WeakMap<Element, Promise<Resumed>>()

/**
 * Makes server-rendered HTML interactive without calling any component: seeds an owned store from the manifest,
 * subscribes `data-sleek-bind` text, and runs lazily loaded handlers through one FIFO queue with `layer`.
 * Rejects with `ManifestInvalid`, `ManifestDecodeFailed` or the original layer error, leaving the container untouched.
 */
export const resume = <R, LE>(opts: ResumeOptions<R, LE>): Promise<Resumed> => {
  const existing = activations.get(opts.container)
  if (existing) return existing
  const p = activate(opts)
  activations.set(opts.container, p)
  p.catch(() => activations.get(opts.container) === p && activations.delete(opts.container))
  return p
}

const readManifest = (container: Element): { events: Array<string>; atoms: Record<string, unknown> } => {
  const scripts = container.querySelectorAll('script[data-sleek-manifest]')
  if (scripts.length !== 1) throw new ManifestInvalid({ reason: `expected one manifest, found ${scripts.length}` })
  let m: any
  try {
    m = JSON.parse(scripts[0]!.textContent ?? '')
  } catch {
    throw new ManifestInvalid({ reason: 'malformed JSON' })
  }
  const ok =
    m && m.v === 1 && Array.isArray(m.events) && m.events.every((e: unknown) => typeof e === 'string') &&
    m.atoms && typeof m.atoms === 'object' && !Array.isArray(m.atoms)
  if (!ok) throw new ManifestInvalid({ reason: 'unexpected shape' })
  return m
}

const decode = (atom: Atom.Atom<any> | undefined, key: string, value: unknown): unknown => {
  if (!atom || !Atom.isWritable(atom)) throw new ManifestDecodeFailed({ key })
  const info = atom.serializable
  if (!info) return value
  if (info.kind === 'result') throw new ManifestDecodeFailed({ key })
  try {
    return Schema.decodeUnknownSync(info.schema)(value)
  } catch (cause) {
    throw new ManifestDecodeFailed({ key, cause })
  }
}

const original = (cause: Cause.Cause<unknown>): unknown => {
  const failure = Cause.failureOption(cause)
  if (Option.isSome(failure)) return failure.value
  const defect = Cause.dieOption(cause)
  return Option.isSome(defect) ? defect.value : Cause.squash(cause)
}

const snapshot = (e: Event): HandlerEvent => {
  const t = e.target as Element | null
  const out: { type: string; value?: string; checked?: boolean; key?: string } = { type: e.type }
  const tag = t?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') out.value = (t as HTMLInputElement).value
  if (tag === 'INPUT') out.checked = (t as HTMLInputElement).checked
  if (typeof (e as KeyboardEvent).key === 'string') out.key = (e as KeyboardEvent).key
  return out
}

const activate = async <R, LE>(opts: ResumeOptions<R, LE>): Promise<Resumed> => {
  const { container } = opts
  const m = readManifest(container)
  const seeds = Object.entries(m.atoms).map(([key, v]) => [key, opts.atoms[key]!, decode(opts.atoms[key], key, v)] as const)
  const binds = [...container.querySelectorAll('[data-sleek-bind]')].map((node) => {
    const key = node.getAttribute('data-sleek-bind')!
    if (!(key in m.atoms)) throw new ManifestInvalid({ reason: `bind key "${key}" missing from manifest` })
    return { node, atom: opts.atoms[key]! }
  })

  const store = makeAtomStore()
  for (const [key, atom, v] of seeds) {
    try {
      store.set(atom, v)
    } catch (cause) {
      await store.dispose()
      throw new ManifestDecodeFailed({ key, cause })
    }
  }

  const scope = Effect.runSync(Scope.make())
  const built = await Effect.runPromiseExit(Layer.buildWithScope(opts.layer, scope))
  if (Exit.isFailure(built)) {
    await Effect.runPromiseExit(Scope.close(scope, built)) // a finalizer defect never replaces the layer error
    await store.dispose()
    throw original(built.cause)
  }

  const ctx = Context.add(Context.add(built.value as Context.Context<unknown>, Store, store), Scope.Scope, scope)

  let active = true
  const report = (cause: Cause.Cause<unknown>) => {
    try {
      if (opts.onError) opts.onError(cause)
      else console.error(Cause.pretty(cause))
    } catch (sinkError) {
      console.error(sinkError)
    }
  }

  // A rejected or mismatched load is not cached: the next event retries.
  const loads = new Map<string, Promise<Handler<any, any>>>()
  const load = (id: string): Promise<Handler<any, any>> => {
    const cached = loads.get(id)
    if (cached) return cached
    const loader = Object.hasOwn(opts.handlers, id) ? opts.handlers[id] : undefined
    const p = loader
      ? Promise.resolve()
          .then(loader)
          .then((mod) => {
            if (mod?.default?.id !== id) throw new HandlerIdMismatch({ key: id, id: String(mod?.default?.id) })
            return mod.default
          })
      : Promise.reject(new UnknownHandler({ id }))
    loads.set(id, p)
    p.catch(() => loads.get(id) === p && loads.delete(id))
    return p
  }

  let tail: Promise<void> = Promise.resolve()
  const enqueue = (id: string, event: HandlerEvent) => {
    const loading = load(id)
    loading.catch(() => {}) // reported in queue order below
    tail = tail.then(async () => {
      let h: Handler<any, any>
      try {
        h = await loading
      } catch (error) {
        if (active) report(error instanceof UnknownHandler || error instanceof HandlerIdMismatch ? Cause.fail(error) : Cause.die(error))
        return
      }
      if (!active) return
      // Forked into the client Scope so `dispose` interrupts a run in flight; suspend turns a sync throw into a defect.
      const run = Effect.provide(Effect.suspend(() => h.run(event)), ctx as Context.Context<any>)
      const exit = await Effect.runPromise(Effect.flatMap(Effect.forkIn(run, scope), Fiber.await))
      if (active && Exit.isFailure(exit)) report(exit.cause)
    })
  }

  const listener = (e: Event) => {
    if (!active) return
    const attr = `data-sleek-on-${e.type}`
    const target = (e.target as Element | null)?.closest?.(`[${attr}]`)
    if (!target || !container.contains(target)) return
    if (target.hasAttribute(`data-sleek-pd-${e.type}`)) e.preventDefault()
    if (target.hasAttribute(`data-sleek-sp-${e.type}`)) e.stopPropagation()
    enqueue(target.getAttribute(attr)!, snapshot(e))
  }

  const unsubs = binds.map(({ node, atom }) => store.subscribe(atom, () => void (node.textContent = String(store.get(atom)))))
  for (const type of m.events) container.addEventListener(type, listener)

  const handle: Resumed = {
    dispose: async () => {
      if (!active) return
      active = false
      for (const type of m.events) container.removeEventListener(type, listener)
      for (const u of unsubs) u()
      activations.delete(container) // the entry is ours while active
      await Effect.runPromise(Scope.close(scope, Exit.void))
      await store.dispose()
    },
  }
  return handle
}
