/** @jsxImportSource @sleekstack/ui */
import { Layer } from 'effect'
import { renderToString, resume } from '@sleekstack/ui'
import increment, { countAtom } from './increment'

// A defineHandler value on onClick, and a serializable atom as a child (bound text).
const Counter = () => (
  <div>
    <button onClick={increment}>+1</button>
    <output>{countAtom}</output>
  </div>
)

export const page = () => renderToString(<Counter />, { layer: Layer.empty })

// The client entry: no component code and no React, only the handlers' loaders and the bound atoms.
export const start = (container: Element) =>
  resume({ container, layer: Layer.empty, handlers: { increment: () => import('./increment') }, atoms: [countAtom] })
