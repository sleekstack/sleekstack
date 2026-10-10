import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Effect, Layer } from 'effect'
import { makeAtomStore } from '@sleekstack/core'
import { el, mount } from '@sleekstack/ui'
import { UiPanel, uiTrace } from '@sleekstack/devtools'

const App = () => Effect.sync(() => el('p', {}, 'Hello'))

// Development only: in production, skip the trace and the panel.
const trace = uiTrace()
for (const id of ['left', 'right']) {
  // One store and one observer per mount; the panel reads each mount's atoms from its own store.
  const store = makeAtomStore()
  await mount(App(), {
    layer: Layer.empty,
    container: document.getElementById(id)!,
    store,
    observe: trace.observer(store),
  })
}

// UiPanel is a React component; render it in its own root.
createRoot(document.getElementById('devtools')!).render(createElement(UiPanel, { trace }))
