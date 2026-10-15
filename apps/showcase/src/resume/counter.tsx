/** @jsxImportSource @sleekstack/ui */
import { countAtom } from './count'
import increment from './increment'
import set from './set'

/** A resumable counter: server-rendered, then interactive without re-running. Its form action resumes too. */
export const Counter = () => (
  <div className="counter">
    <button onClick={increment}>+1</button>
    <output>{countAtom}</output>
    <form action={set}>
      <input name="to" type="number" value={10} />
      <button type="submit">Set</button>
    </form>
  </div>
)
