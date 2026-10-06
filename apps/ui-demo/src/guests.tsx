// Plain React: guests run under their own react-dom and receive no Effect context.
import { useState } from 'react'
import { fromReact } from '@sleekstack/ui'

const AvatarView = ({ name }: { name: string }) => (
  <span className="avatar" title={name}>
    {name.slice(0, 1)}
  </span>
)
export const Avatar = fromReact(AvatarView)

const PRIORITIES = ['low', 'medium', 'high'] as const
const AddView = ({ onAdd }: { onAdd: (task: { title: string; priority: 'low' | 'medium' | 'high' }) => void }) => {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('medium')
  return (
    <form
      className="add"
      onSubmit={(e) => {
        e.preventDefault()
        if (!title.trim()) return
        onAdd({ title: title.trim(), priority })
        setTitle('')
      }}
    >
      <input className="new-title" placeholder="New task" value={title} onChange={(e) => setTitle(e.target.value)} />
      <select className="new-priority" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
        {PRIORITIES.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>
      <button type="submit">Add task</button>
    </form>
  )
}
/** A plain React form with its own draft state; the host passes `mutate` as `onAdd`. */
export const AddTaskForm = fromReact(AddView)

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
