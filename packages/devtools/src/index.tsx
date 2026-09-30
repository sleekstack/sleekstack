'use client'
/**
 * packages/devtools/src/index.tsx — @sleekstack/devtools
 *
 * `<SleekStackDevtools />`: polls the `@sleekstack/next/devtools` handler and renders graph, live
 * scopes, read-only atom values and recent errors. Dev only: the caller mounts it outside production.
 */
import { useEffect, useState } from 'react'
import type { Atom } from '@sleekstack/core'
import { useAtomValue } from '@sleekstack/react'

/** Present in every devtools bundle; production bundle tests assert it is absent from client chunks. */
export const DEVTOOLS_MARKER = 'sleekstack-devtools-panel-9f3c'

interface DevEvent { readonly at: number; readonly kind: string; readonly label: string; readonly detail?: string }
interface ReportGraph {
  readonly nodes: readonly { readonly id: string; readonly name: string; readonly lifetime: string }[]
  readonly edges: readonly { readonly from: string; readonly to: string; readonly tag: string }[]
}
/** The handler's JSON body (`devtoolsSnapshot`); `graph` is an analyzer Report when the app supplied one. */
export interface DevtoolsData {
  readonly scopes: readonly DevEvent[]
  readonly errors: readonly DevEvent[]
  readonly live: { readonly app: boolean; readonly scopes: readonly string[] }
  readonly graph?: { readonly roots?: readonly { readonly root: string; readonly graph: ReportGraph }[] }
}

export interface SleekStackDevtoolsProps {
  /** Handler route; default `/api/devtools`. */
  readonly endpoint?: string
  /** Poll interval in ms; default 2000. */
  readonly intervalMs?: number
  /** Atoms to show (read-only), by label. Needs a `LayerProvider` above the panel. */
  readonly atoms?: Readonly<Record<string, Atom.Atom<unknown>>>
}

const show = (value: unknown): string => {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

function AtomRow({ label, atom }: { readonly label: string; readonly atom: Atom.Atom<unknown> }) {
  return <li>{label}: <code>{show(useAtomValue(atom))}</code></li>
}

const isDevtoolsData = (v: unknown): v is DevtoolsData => {
  const d = v as Partial<DevtoolsData> | null
  return (
    typeof d === 'object' && d !== null &&
    Array.isArray(d.scopes) && Array.isArray(d.errors) &&
    typeof d.live === 'object' && d.live !== null && Array.isArray(d.live.scopes)
  )
}

/** Polls `endpoint` (next poll only after the previous settles); `null` while off (404, network error or non-JSON). */
function useDevtoolsData(endpoint: string, intervalMs: number): DevtoolsData | null {
  const [data, setData] = useState<DevtoolsData | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      try {
        const res = await fetch(endpoint, { signal: controller.signal })
        const body: unknown = res.ok ? await res.json() : null
        const next = isDevtoolsData(body) ? body : null
        if (!controller.signal.aborted) setData(next)
      } catch {
        if (!controller.signal.aborted) setData(null)
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, intervalMs)
    }
    void poll()
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [endpoint, intervalMs])
  return data
}

export function SleekStackDevtools({ endpoint = '/api/devtools', intervalMs = 2000, atoms }: SleekStackDevtoolsProps) {
  const data = useDevtoolsData(endpoint, intervalMs)
  const entries = Object.entries(atoms ?? {})
  return (
    <aside aria-label="SleekStack devtools" data-devtools={DEVTOOLS_MARKER} style={{ borderTop: '1px solid #ccc', marginTop: '2rem', fontSize: 13 }}>
      <h2>SleekStack devtools</h2>
      {data === null ? (
        <p>Devtools are off: the handler at {endpoint} is not reachable in this build.</p>
      ) : (
        <>
          <section aria-label="graph">
            <h3>Graph</h3>
            {data.graph?.roots?.length ? (
              data.graph.roots.map((r) => (
                <div key={r.root}>
                  <strong>{r.root}</strong>: {r.graph.nodes.length} nodes, {r.graph.edges.length} edges
                  <ul>{r.graph.nodes.map((n) => <li key={n.id}>{n.name} ({n.lifetime})</li>)}</ul>
                  <ul aria-label="edges">{r.graph.edges.map((e) => <li key={`${e.from}>${e.to}>${e.tag}`}>{e.from} → {e.to} ({e.tag})</li>)}</ul>
                </div>
              ))
            ) : (
              <p>No graph report supplied.</p>
            )}
          </section>
          <section aria-label="scopes">
            <h3>Live scopes</h3>
            <p>App runtime: {data.live.app ? 'built' : 'not built'}</p>
            <ul>{data.live.scopes.map((s) => <li key={s}>{s}</li>)}</ul>
            {data.live.scopes.length === 0 && <p>No open request scopes.</p>}
          </section>
          <section aria-label="errors">
            <h3>Errors</h3>
            {data.errors.length === 0 ? <p>No errors recorded.</p> : (
              <ul>{data.errors.slice(-10).map((e) => <li key={`${e.at}-${e.label}`}><pre>{e.detail ?? e.label}</pre></li>)}</ul>
            )}
          </section>
        </>
      )}
      <section aria-label="atoms">
        <h3>Atoms</h3>
        {entries.length === 0 ? <p>No atoms registered.</p> : <ul>{entries.map(([k, a]) => <AtomRow key={k} label={k} atom={a} />)}</ul>}
      </section>
    </aside>
  )
}
