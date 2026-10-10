/**
 * packages/devtools/src/ui/uiPanel.tsx
 *
 * Devtools for `@sleekstack/ui` mounts: `uiTrace()` is a `RenderObserver` that keeps the live instance tree and
 * bounded logs of re-runs and effect runs; `<UiPanel>` polls it and shows the tree (keys, slots), each instance's
 * atoms with current values (slot labels matched against `store.inspect()`), re-run reasons and effect runs.
 * Built from observer events only, never from `data-sleek` markers in the DOM (guest markup can forge those).
 */
import { useEffect, useState } from 'react'
import type { AtomStore } from '@sleekstack/core'
import type { RenderEvent, RenderObserver, RerunReason } from '@sleekstack/ui'

export interface UiInstance {
  readonly mount: number
  readonly instance: number
  readonly parent?: number
  readonly path: string
  readonly key?: string
  readonly adopted: boolean
  /** Owned atom labels by slot index. */
  readonly slots: readonly string[]
}

export interface UiRerun {
  readonly at: number
  readonly mount: number
  readonly instance: number
  readonly reasons: readonly RerunReason[]
}

export interface UiEffectRun {
  readonly at: number
  readonly mount: number
  readonly instance: number
  readonly index: number
  readonly phase: 'start' | 'restart' | 'cleanup'
}

export interface UiTrace {
  /** An `observe` for `mount`/`hydrateMount`; pass the mount's `AtomStore` to show its atom values. One trace may observe several mounts. */
  readonly observer: (store?: AtomStore) => RenderObserver
  readonly read: () => {
    /** The store each observed mount was given, by mount id. */
    readonly stores: ReadonlyMap<number, AtomStore>
    readonly instances: readonly UiInstance[]
    readonly reruns: readonly UiRerun[]
    readonly effects: readonly UiEffectRun[]
  }
}

const LOG = 50

/** A recorder for render events: live instances, and the last `LOG` re-runs and effect runs each. */
export function uiTrace(): UiTrace {
  const instances = new Map<string, UiInstance>()
  const reruns: UiRerun[] = []
  const effects: UiEffectRun[] = []
  const stores = new Map<number, AtomStore>()
  const id = (e: { mount: number; instance: number }) => `${e.mount}:${e.instance}`
  const push = <T,>(log: T[], entry: T) => {
    log.push(entry)
    if (log.length > LOG) log.shift()
  }
  const observe = (e: RenderEvent) => {
    switch (e.type) {
      case 'create':
      case 'adopt':
        instances.set(id(e), {
          mount: e.mount,
          instance: e.instance,
          ...(e.parent === undefined ? {} : { parent: e.parent }),
          path: e.path,
          ...(e.key === undefined ? {} : { key: e.key }),
          adopted: e.type === 'adopt',
          slots: [],
        })
        return
      case 'dispose':
        instances.delete(id(e))
        return
      case 'slot': {
        const inst = instances.get(id(e))
        if (!inst) return
        const slots = [...inst.slots]
        slots[e.index] = e.atom
        instances.set(id(e), { ...inst, slots })
        return
      }
      case 'rerun':
        return push(reruns, { at: Date.now(), mount: e.mount, instance: e.instance, reasons: e.reasons })
      case 'effect':
        return push(effects, { at: Date.now(), mount: e.mount, instance: e.instance, index: e.index, phase: e.phase })
    }
  }
  const observer = (store?: AtomStore) => (e: RenderEvent) => {
    if (store && !stores.has(e.mount)) stores.set(e.mount, store)
    observe(e)
  }
  return {
    observer,
    read: () => ({
      stores: new Map(stores),
      instances: [...instances.values()],
      reruns: [...reruns],
      effects: [...effects],
    }),
  }
}

const show = (value: unknown): string => {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

const reason = (r: RerunReason) => (r.cause === 'atom' ? `atom ${r.atom}` : 'parent re-run')

// Current atom values by mount id, then label; a disposed store shows no values.
const read = (trace: UiTrace) => {
  const snap = trace.read()
  const values = new Map<number, Map<string, unknown>>()
  for (const [mount, store] of snap.stores) {
    try {
      values.set(mount, new Map(store.inspect().map((a) => [a.label, a.value])))
    } catch {
      values.set(mount, new Map())
    }
  }
  return { ...snap, values }
}

export interface UiPanelProps {
  readonly trace: UiTrace
  /** Poll interval in ms; default 1000. */
  readonly intervalMs?: number
}

/** The four ui views for every mount `trace` observes, re-read every `intervalMs`. */
export function UiPanel({ trace, intervalMs = 1000 }: UiPanelProps) {
  const [snap, setSnap] = useState(() => read(trace))
  useEffect(() => {
    setSnap(read(trace))
    const timer = setInterval(() => setSnap(read(trace)), intervalMs)
    return () => clearInterval(timer)
  }, [trace, intervalMs])
  const { instances, reruns, effects, values } = snap
  // Mount and instance ids keep equal paths (siblings' children, several mounts) apart.
  const name = (mount: number, instance: number) =>
    `mount ${mount} #${instance} ${instances.find((i) => i.mount === mount && i.instance === instance)?.path ?? (instance === 0 ? 'root' : '(disposed)')}`
  const children = (mount: number, parent: number | undefined) =>
    instances.filter((i) => i.mount === mount && i.parent === parent)
  const tree = (i: UiInstance) => (
    <li key={i.instance}>
      {i.path}
      {i.key === undefined ? '' : ` key=${i.key}`}
      {i.adopted ? ' (adopted)' : ''}
      {i.slots.length > 0 && ` slots: ${i.slots.join(', ')}`}
      {children(i.mount, i.instance).length > 0 && <ul>{children(i.mount, i.instance).map(tree)}</ul>}
    </li>
  )
  const mounts = [...new Set(instances.map((i) => i.mount))]
  const roots = (mount: number) =>
    instances.filter(
      (i) =>
        i.mount === mount &&
        (i.parent === undefined || !instances.some((p) => p.mount === mount && p.instance === i.parent)),
    )
  return (
    <section aria-label="ui">
      <h3>UI</h3>
      <section aria-label="instance tree">
        <h4>Instances</h4>
        {mounts.length === 0 ? (
          <p>No mounted instances.</p>
        ) : (
          mounts.map((m) => (
            <div key={m}>
              mount {m}
              <ul>{roots(m).map(tree)}</ul>
            </div>
          ))
        )}
      </section>
      <section aria-label="instance atoms">
        <h4>Atoms per instance</h4>
        <ul>
          {instances
            .filter((i) => i.slots.length > 0)
            .map((i) => (
              <li key={`${i.mount}:${i.instance}`}>
                {name(i.mount, i.instance)}:{' '}
                {i.slots.map((label, n) => (
                  <span key={n}>
                    {label}=
                    <code>
                      {values.get(i.mount)?.has(label) ? show(values.get(i.mount)!.get(label)) : '(unbuilt)'}
                    </code>{' '}
                  </span>
                ))}
              </li>
            ))}
        </ul>
      </section>
      <section aria-label="re-runs">
        <h4>Re-runs</h4>
        {reruns.length === 0 ? (
          <p>No re-runs recorded.</p>
        ) : (
          <ul>
            {reruns.map((r, n) => (
              <li key={n}>{`${name(r.mount, r.instance)}: ${r.reasons.map(reason).join(', ')}`}</li>
            ))}
          </ul>
        )}
      </section>
      <section aria-label="effect runs">
        <h4>Effect runs</h4>
        {effects.length === 0 ? (
          <p>No effect runs recorded.</p>
        ) : (
          <ul>
            {effects.map((e, n) => (
              <li key={n}>{`${name(e.mount, e.instance)} effect ${e.index}: ${e.phase}`}</li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}
