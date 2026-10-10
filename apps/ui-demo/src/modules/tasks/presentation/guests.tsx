// Plain React: guests run under their own react-dom and receive no Effect context.
import { useState } from 'react'
import { fromReact } from '@sleekstack/ui'

// Reactions are client-side only: the count lives in the guest, not the repo.
const VoteView = ({ initial }: { initial: number }) => {
  const [votes, setVotes] = useState(initial)
  return (
    <button type="button" className="vote" onClick={() => setVotes(votes + 1)}>
      {`▲ ${votes}`}
    </button>
  )
}
export const Votes = fromReact(VoteView)

const FilterView = ({ options, onPick }: { options: ReadonlyArray<string>; onPick: (value: any) => void }) => (
  <div className="row filter">
    {options.map((o) => (
      <button type="button" key={o} data-value={o} onClick={() => onPick(o)}>
        {o}
      </button>
    ))}
  </div>
)
/** Plain React buttons; each click calls `onPick` with its option. */
export const FilterBar = fromReact(FilterView)
