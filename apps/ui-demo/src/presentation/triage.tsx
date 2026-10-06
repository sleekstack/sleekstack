/** @jsxImportSource @sleekstack/ui */
import { Effect } from 'effect'
import { useLocal } from '@sleekstack/ui'
import type { Task } from '../domain/model'
import { Votes } from './guests'

/** Instance-local search, sort order and collapse; the keyed rows keep their nodes and guests when they reorder. */
export const Triage = ({ tasks }: { tasks: ReadonlyArray<Task> }) =>
  Effect.gen(function* () {
    const [query, setQuery] = yield* useLocal('')
    const [desc, setDesc] = yield* useLocal(false)
    const [open, setOpen] = yield* useLocal(true)
    const shown = tasks
      .filter((t) => t.title.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => (desc ? -1 : 1) * a.title.localeCompare(b.title))
    return yield* (
      <section className="triage">
        <h3>
          <button type="button" className="collapse" onClick={() => Effect.sync(() => setOpen((o) => !o))}>
            {open ? 'Hide' : 'Show'} triage
          </button>
        </h3>
        <input
          className="search"
          placeholder="Search"
          onInput={(e: Event) => Effect.sync(() => setQuery((e.target as HTMLInputElement).value))}
        />
        <button type="button" className="sort" onClick={() => Effect.sync(() => setDesc((d) => !d))}>
          {desc ? 'Z-A' : 'A-Z'}
        </button>
        {open && (
          <ul className="triage-list">
            {shown.map((t) => (
              <li key={t.id} data-id={t.id}>
                {t.title} <Votes initial={t.votes} />
              </li>
            ))}
          </ul>
        )}
      </section>
    )
  })
