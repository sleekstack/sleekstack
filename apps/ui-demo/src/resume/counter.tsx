/** @jsxImportSource @sleekstack/ui */
import { Bind } from '@sleekstack/ui'
import { countAtom } from './count'
import increment from './increment'

/** A resumable counter: server-rendered, then interactive without re-running. */
export const Counter = () => (
  <div className="counter">
    <button onClick={increment}>+1</button>
    <output>
      <Bind atom={countAtom} />
    </output>
  </div>
)
