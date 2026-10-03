// Plain React: guests run under their own react-dom and receive no Effect context.
import { useState } from 'react'
import { fromReact } from '@sleekstack/ui'

const AvatarView = ({ name }: { name: string }) => (
  <span className="avatar" title={name}>
    {name.slice(0, 1)}
  </span>
)
export const Avatar = fromReact(AvatarView)

const AddView = ({ onAdd }: { onAdd: () => void }) => (
  <button type="button" className="add" onClick={onAdd}>
    Add task
  </button>
)
/** Receives the host's `mutate` as a prop. */
export const AddButton = fromReact(AddView)

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
