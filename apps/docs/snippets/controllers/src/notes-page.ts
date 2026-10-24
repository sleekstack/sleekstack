import { Effect } from 'effect'
import { NoteLookup, NotesApi } from 'virtual:sleek/rpc'

/** A loader's work. On the server each call runs in process; in the browser it posts to `/_sleek/fn/<Tag>.<method>`. */
export const titles = Effect.flatMap(NotesApi, (api) => api.mine()).pipe(
  Effect.map((notes) => notes.map((note) => note.title)),
)

/** A wrapped Controller Method takes the Controller's input and fails with its typed errors, here `NoteNotFound`. */
export const remove = (id: number) => Effect.flatMap(NoteLookup, (lookup) => lookup.remove({ params: { id } }))
