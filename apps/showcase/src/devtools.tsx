import { UiPanel, type UiTrace } from '@sleekstack/devtools'
import { createRoot } from 'react-dom/client'

/** Renders the ui devtools panel into its own React root below the demo, at `#devtools` (the Devtools page links it). */
export function openDevtools(trace: UiTrace) {
  const host = document.body.appendChild(document.createElement('div'))
  host.id = 'devtools'
  createRoot(host).render(<UiPanel trace={trace} />)
}
