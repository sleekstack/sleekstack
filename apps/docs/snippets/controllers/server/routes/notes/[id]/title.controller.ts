import { Controller, type Gen } from '@sleekstack/start'
import { type NoteNotFound, Notes, Viewer } from '../../../notes'

/**
 * `GET /notes/7/title`, as a class Controller. `notes` and `viewer` are resolved per request and are on `this`, so
 * `viewer` may come from the directory `wrap`; `check` counts both as requirements.
 */
export default class extends Controller({ notes: Notes, viewer: Viewer }) {
  *GET(input: { readonly params: { readonly id: number } }): Gen<string, NoteNotFound> {
    const note = yield* this.notes.find(input.params.id)
    return note.author === this.viewer.name ? note.title : `${note.title} (by ${note.author})`
  }
}
