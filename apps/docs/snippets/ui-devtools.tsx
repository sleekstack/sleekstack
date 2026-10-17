import { Effect, Layer } from 'effect'
import { makeAtomStore } from '@sleekstack/core'
import { el, mount } from '@sleekstack/ui'
import { jsx } from '@sleekstack/ui/jsx-runtime'

const App = () => Effect.sync(() => el('p', {}, 'Hello'))

// Development only: the dynamic imports keep devtools out of production bundles.
const devtools = process.env.NODE_ENV === 'production' ? undefined : await import('@sleekstack/devtools')
const trace = devtools?.uiTrace()

for (const id of ['left', 'right']) {
  // One store and one observer per mount; the panel reads each mount's atoms from its own store.
  const store = makeAtomStore()
  await mount(App(), {
    layer: Layer.empty,
    container: document.getElementById(id)!,
    store,
    observe: trace?.observer(store),
  })
}

// UiPanel is a ui component: mount it like any other.
if (devtools && trace) {
  await mount(jsx(devtools.UiPanel, { trace }), { layer: Layer.empty, container: document.getElementById('devtools')! })
}
