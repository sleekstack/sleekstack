/** @jsxImportSource @sleekstack/ui */
import { UiPanel, type UiTrace } from '@sleekstack/devtools'
import { mount } from '@sleekstack/ui'
import { Layer } from 'effect'

/** Mounts the ui devtools panel below the demo, at `#devtools` (the Devtools page links it). */
export function openDevtools(trace: UiTrace) {
  const host = document.body.appendChild(document.createElement('div'))
  host.id = 'devtools'
  return mount(<UiPanel trace={trace} />, { layer: Layer.empty, container: host })
}
