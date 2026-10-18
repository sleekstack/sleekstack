/** @jsxImportSource @sleekstack/ui */
import { Layer } from 'effect'
import { renderToString } from '@sleekstack/ui'
import { countAtom } from './count'
import increment from './increment'

// Server only: a defineHandler value on onClick, and a serializable atom as a child (bound text).
const Counter = () => (
  <div>
    <button onClick={increment}>+1</button>
    <output>{countAtom}</output>
  </div>
)

export const page = () => renderToString(<Counter />, { layer: Layer.empty })
