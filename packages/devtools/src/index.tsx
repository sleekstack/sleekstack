'use client'
/**
 * packages/devtools/src/index.tsx — @sleekstack/devtools
 *
 * `<SleekStackDevtools />`: polls the `@sleekstack/next/devtools` handler and renders graph, live
 * scopes, read-only atom values and recent errors. Dev only: the caller mounts it outside production.
 */
import { useEffect, useMemo, useState } from 'react'
import type { Atom } from '@sleekstack/core'
import { useAtomValue } from '@sleekstack/react'
import { ScopedErrors, ServiceEvents, type DevEvent } from './panel/sections'

/** Present in every devtools bundle; production bundle tests assert it is absent from client chunks. */
export const DEVTOOLS_MARKER = 'sleekstack-devtools-panel-9f3c'

interface ReportGraph {
  readonly nodes: readonly { readonly id: string; readonly name: string; readonly lifetime: string }[]
  readonly edges: readonly { readonly from: string; readonly to: string; readonly tag: string }[]
}
interface RootGraph extends ReportGraph { readonly root: string }
/** The handler's JSON body (`devtoolsSnapshot`); `graph` is an analyzer Report when the app supplied one. */
export interface DevtoolsData {
  /** Tracing off on the server (absent from older handlers: treated as enabled). */
  readonly disabled?: boolean
  readonly scopes: readonly DevEvent[]
  readonly errors: readonly DevEvent[]
  readonly live: { readonly app: boolean; readonly scopes: readonly string[] }
  readonly graph?: unknown
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

const REQUEST_TIMEOUT_MS = 5000

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const strs = (v: unknown, keys: readonly string[]): boolean => isObj(v) && keys.every((k) => typeof v[k] === 'string')
const isEvent = (v: unknown): v is DevEvent =>
  strs(v, ['kind', 'label']) && typeof (v as DevEvent).at === 'number' &&
  (['detail', 'scope', 'fiber'] as const).every((k) => (v as DevEvent)[k] === undefined || typeof (v as DevEvent)[k] === 'string')

const isDevtoolsData = (v: unknown): v is DevtoolsData =>
  isObj(v) &&
  (v.disabled === undefined || typeof v.disabled === 'boolean') &&
  Array.isArray(v.scopes) && v.scopes.every(isEvent) &&
  Array.isArray(v.errors) && v.errors.every(isEvent) &&
  isObj(v.live) && typeof v.live.app === 'boolean' && Array.isArray(v.live.scopes) && v.live.scopes.every((s) => typeof s === 'string')

const isGraph = (g: unknown): g is ReportGraph =>
  isObj(g) &&
  Array.isArray(g.nodes) && g.nodes.every((n) => strs(n, ['id', 'name', 'lifetime'])) &&
  Array.isArray(g.edges) && g.edges.every((e) => strs(e, ['from', 'to', 'tag']))

/**
 * The graphs in whatever the app supplied: an analyzer `Report` (`runtimes[].graph`, else `graphs[]`) or the
 * `sleekstack check --json` envelope (`roots[].graph`). Anything malformed is skipped, never thrown on.
 */
export function graphsOf(report: unknown): readonly RootGraph[] {
  if (!isObj(report)) return []
  const from = (list: unknown, pick: (r: unknown) => unknown): unknown[] => (Array.isArray(list) ? list.map(pick) : [])
  const graphOf = (r: unknown) => (isObj(r) ? r.graph : undefined)
  // The canonical Report (`runtimes`, else `graphs`) or the CLI envelope (`roots`): first source with a graph wins.
  const sources = [from(report.runtimes, graphOf), from(report.graphs, (g) => g), from(report.roots, graphOf)]
  const candidates = sources.find((c) => c.some(isGraph)) ?? []
  return candidates.filter(isGraph).map((g, i) => ({ ...g, root: typeof (g as Partial<RootGraph>).root === 'string' ? (g as RootGraph).root : `graph ${i + 1}` }))
}

/** Polls `endpoint` (next poll only after the previous settles); `undefined` until the first response, `null` while off (404, network error or non-JSON). */
function useDevtoolsData(endpoint: string, intervalMs: number): DevtoolsData | null | undefined {
  const [data, setData] = useState<DevtoolsData | null | undefined>(undefined)
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      // Each attempt has its own timeout, so a hung connection cannot stop polling for good.
      const attempt = new AbortController()
      const timeout = setTimeout(() => attempt.abort(), REQUEST_TIMEOUT_MS)
      const onAbort = () => attempt.abort()
      controller.signal.addEventListener('abort', onAbort, { once: true })
      try {
        const res = await fetch(endpoint, { signal: attempt.signal })
        const body: unknown = res.ok ? await res.json() : null
        const next = isDevtoolsData(body) ? body : null
        if (!controller.signal.aborted) setData(next)
      } catch {
        if (!controller.signal.aborted) setData(null)
      } finally {
        clearTimeout(timeout)
        controller.signal.removeEventListener('abort', onAbort)
        if (!controller.signal.aborted) timer = setTimeout(poll, intervalMs)
      }
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
  const graphs = useMemo(() => graphsOf(data?.graph), [data])
  return (
    <aside aria-label="SleekStack devtools" data-devtools={DEVTOOLS_MARKER} style={{ borderTop: '1px solid #ccc', marginTop: '2rem', fontSize: 13 }}>
      <h2>SleekStack devtools</h2>
      {data === undefined ? (
        <p>Connecting to {endpoint}…</p>
      ) : data === null ? (
        <p>Devtools are off: the handler at {endpoint} is not reachable in this build.</p>
      ) : data.disabled ? (
        <p>Devtools tracing is disabled in this build: nothing is recorded.</p>
      ) : (
        <>
          <section aria-label="graph">
            <h3>Graph</h3>
            {graphs.length ? (
              graphs.map((g) => (
                <div key={g.root}>
                  <strong>{g.root}</strong>: {g.nodes.length} nodes, {g.edges.length} edges
                  <ul>{g.nodes.map((n) => <li key={n.id}>{n.name} ({n.lifetime})</li>)}</ul>
                  <ul aria-label="edges">{g.edges.map((e) => <li key={`${e.from}>${e.to}>${e.tag}`}>{e.from} → {e.to} ({e.tag})</li>)}</ul>
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
          <ServiceEvents events={data.scopes} />
          <ScopedErrors errors={data.errors} live={data.live.scopes} />
        </>
      )}
      <section aria-label="atoms">
        <h3>Atoms</h3>
        {entries.length === 0 ? <p>No atoms registered.</p> : <ul>{entries.map(([k, a]) => <AtomRow key={k} label={k} atom={a} />)}</ul>}
      </section>
    </aside>
  )
}
