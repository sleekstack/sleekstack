/** @jsxImportSource @sleekstack/ui */
import { makeAtomStore } from '@sleekstack/core'
import { mount } from '@sleekstack/ui'
import { App } from './app'
import { AppWithQueriesLive } from './layers'

// Dev only: `import.meta.env.DEV` is false in `vite build`, so the trace and the devtools chunk drop out.
const trace = import.meta.env.DEV ? (await import('@sleekstack/devtools')).uiTrace() : undefined

for (const [id, viewer] of [
  ['ada', 'u1'],
  ['grace', 'u2'],
] as const) {
  const store = makeAtomStore()
  void mount(<App viewer={viewer} />, {
    layer: AppWithQueriesLive(),
    container: document.getElementById(id)!,
    store,
    observe: trace?.observer(store),
  })
}

if (trace) void import('./devtools').then(({ openDevtools }) => openDevtools(trace))
