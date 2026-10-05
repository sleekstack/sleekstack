/**
 * apps/playground/src/api-example.tsx
 *
 * Phase 1 happy-path demo — demonstrates all six ROADMAP success criteria (D-09):
 *
 *   1. module() compilation with imports (CORE-01, CORE-03)
 *   2. Layer-scoped finalizer (REACT-08 cleanup observable in console)
 *   3. useService resolving under Suspense (REACT-03, REACT-04)
 *   4. Nested LayerProvider with shadowing (REACT-02, REACT-05)
 *   5. Missing-service error caught by ErrorBoundary (REACT-06 — see ErrorBoundary)
 *   6. Services clean up on unmount (REACT-08 — finalizer logs in console)
 *
 * Deferred (per 01-CONTEXT.md): full DX error showcase for circular deps and
 * missing service errors — happy-path only in Phase 1.
 */

import React, { Suspense } from 'react'
import { module } from '@sleekstack/core'
import { LayerProvider, useService } from '@sleekstack/react'
import { HttpClient, Logger, UserApi } from './tags'
import { HttpClientLayer, LoggerLayer, MockHttpClientLayer, UserApiLayer } from './services.server'

// ---------------------------------------------------------------------------
// Tags (./tags.ts) and Layer implementations (./services.server.ts) live in
// separable modules (R11): a bundle that imports only ./tags never drags in
// the implementations — proved by src/__tests__/bundle.test.ts.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// module() definitions — demonstrates CORE-01 (module with name/entries/imports)
// and CORE-03 (imports auto-pulled into LayerProvider without manual re-declaration)
// ---------------------------------------------------------------------------

// HttpModule provides HttpClient only
const HttpModule = module({
  name: 'HttpModule',
  entries: [HttpClientLayer],
  exports: [HttpClient],
})

// AppModule imports HttpModule and adds UserApi — when placed in LayerProvider,
// HttpModule's layers (HttpClientLayer) are automatically pulled into scope (CORE-03).
const AppModule = module({
  name: 'AppModule',
  entries: [UserApiLayer],
  imports: [HttpModule],
  exports: [UserApi],
})

// ---------------------------------------------------------------------------
// Consumer components — useService with useEffect cancelled-flag pattern (D-01)
// ---------------------------------------------------------------------------

function GreetingCard({ name }: { name: string }) {
  const userApi = useService(UserApi)
  const logger = useService(Logger)

  const [greeting, setGreeting] = React.useState<string | null>(null)
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    let cancelled = false
    logger.log(`Fetching greeting for ${name}`)
    userApi
      .getGreeting(name)
      .then((g) => {
        if (!cancelled) setGreeting(g)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)))
      })
    return () => {
      cancelled = true
    }
  }, [userApi, logger, name])

  if (error) return <div style={{ color: 'red' }}>Error: {error.message}</div>
  if (!greeting) return <div style={{ color: '#888' }}>Loading greeting for {name}...</div>

  return (
    <div
      style={{
        padding: '12px 16px',
        margin: '8px 0',
        background: '#f0f7ff',
        borderRadius: '6px',
        border: '1px solid #b8d4ff',
      }}
    >
      {greeting}
    </div>
  )
}

/** Renders inside the nested (shadowed) provider — uses MockHttpClient */
function HttpStatusCard() {
  const http = useService(HttpClient)
  const [status, setStatus] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    http
      .get('https://api.example.com/status')
      .then((r) => {
        if (!cancelled) setStatus(r)
      })
      .catch(() => {
        if (!cancelled) setStatus('request failed')
      })
    return () => {
      cancelled = true
    }
  }, [http])

  if (!status) return <div style={{ color: '#888' }}>Fetching status...</div>

  return (
    <div
      style={{
        padding: '12px 16px',
        background: '#fff8e1',
        borderRadius: '6px',
        border: '1px solid #ffe082',
        fontFamily: 'monospace',
        fontSize: '13px',
      }}
    >
      {status}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ErrorBoundary — copied verbatim from prototype (01-PATTERNS.md, lines 352–378).
// Renders only error.message, not the stack, per the library's identifier-only
// error policy (T-04-03, 01-RESEARCH.md Security Domain).
// ---------------------------------------------------------------------------

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            backgroundColor: '#ffe0e0',
            border: '2px solid #ff0000',
            padding: '20px',
            borderRadius: '4px',
            marginBottom: '20px',
          }}
        >
          <h2 style={{ color: '#cc0000' }}>Error loading service</h2>
          <p>{this.state.error?.message}</p>
        </div>
      )
    }
    return this.props.children
  }
}

// ---------------------------------------------------------------------------
// Main demo component
// ---------------------------------------------------------------------------

export default function ApiExample() {
  return (
    // Outer LayerProvider: provides AppModule (which transitively provides HttpModule
    // via imports — CORE-03 auto-pull) and LoggerLayer.
    <LayerProvider provide={[AppModule, LoggerLayer]}>
      <ErrorBoundary>
        <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px', fontFamily: 'sans-serif' }}>
          <h1 style={{ borderBottom: '2px solid #eee', paddingBottom: '12px' }}>
            SleekStack Phase 1 — Happy Path Demo
          </h1>

          {/* ── Section 1: Basic useService + Suspense (D-08) ── */}
          <section style={{ marginBottom: '32px' }}>
            <h2>1. Service Resolution via Suspense</h2>
            <p style={{ color: '#555', fontSize: '14px' }}>
              <code>useService(UserApi)</code> suspends on first render then resolves synchronously. The Suspense
              fallback shows "Initializing services..." briefly.
            </p>
            <Suspense
              fallback={
                <div style={{ padding: '12px', fontStyle: 'italic', color: '#888' }}>Initializing services...</div>
              }
            >
              <GreetingCard name="Alice" />
              <GreetingCard name="Bob" />
            </Suspense>
          </section>

          {/* ── Section 2: CORE-03 auto-pull (module imports) ── */}
          <section style={{ marginBottom: '32px' }}>
            <h2>2. Module Imports Auto-Pull (CORE-03)</h2>
            <p style={{ color: '#555', fontSize: '14px' }}>
              <code>AppModule</code> imports <code>HttpModule</code>. Only <code>AppModule</code> is listed in the outer{' '}
              <code>LayerProvider</code>; HttpClient is available automatically.
            </p>
            <Suspense
              fallback={
                <div style={{ padding: '12px', fontStyle: 'italic', color: '#888' }}>Loading HttpClient status...</div>
              }
            >
              <HttpStatusCard />
            </Suspense>
          </section>

          {/* ── Section 3: Nested LayerProvider with shadowing (REACT-05, D-09) ── */}
          <section style={{ marginBottom: '32px' }}>
            <h2>3. Nested Provider — Shadowing (REACT-05)</h2>
            <p style={{ color: '#555', fontSize: '14px' }}>
              The inner <code>LayerProvider</code> provides <code>MockHttpClientLayer</code> which shadows the real{' '}
              <code>HttpClient</code> from the outer scope. The card below resolves the mocked value ("[MOCK] Response
              from …"), not the real one.
            </p>
            {/* Inner LayerProvider: shadows HttpClient with the mock */}
            <LayerProvider provide={[MockHttpClientLayer]}>
              <Suspense
                fallback={
                  <div style={{ padding: '12px', fontStyle: 'italic', color: '#888' }}>Loading mocked status...</div>
                }
              >
                <HttpStatusCard />
              </Suspense>
            </LayerProvider>
          </section>

          {/* ── Architecture notes ── */}
          <section
            style={{
              background: '#f9f9f9',
              border: '1px solid #ddd',
              borderRadius: '6px',
              padding: '16px',
              fontSize: '13px',
            }}
          >
            <h3 style={{ marginTop: 0 }}>How this works</h3>
            <ul style={{ lineHeight: '1.8' }}>
              <li>
                <strong>Tags:</strong> <code>Context.GenericTag&lt;T&gt;(id)</code> — service identifiers; imported
                directly from <code>effect</code>
              </li>
              <li>
                <strong>Layers:</strong> <code>Layer.scoped(Tag, Effect.acquireRelease(...))</code> — define services
                with finalizers; finalizers log to console on unmount
              </li>
              <li>
                <strong>Modules:</strong> <code>module(&#123; name, entries, imports &#125;)</code> — group related
                layers; imports are automatically pulled into scope
              </li>
              <li>
                <strong>LayerProvider:</strong> owns one <code>ManagedRuntime</code> per mount; inner provider inherits
                parent context; child layers shadow parent for the same Tag
              </li>
              <li>
                <strong>useService(Tag):</strong> suspends on first call, returns synchronously from cache thereafter;
                throws descriptive error when no provider is found
              </li>
              <li>
                <strong>Cleanup:</strong> open the browser console and unmount the app to see finalizer logs — inner
                scope finalizes before outer (REACT-02)
              </li>
            </ul>
          </section>
        </div>
      </ErrorBoundary>
    </LayerProvider>
  )
}
