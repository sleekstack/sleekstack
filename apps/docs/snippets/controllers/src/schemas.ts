import { Schema } from 'effect'

/** A note as the server answers it. A client-safe file, so a page may import it too. */
export const Note = Schema.Struct({ id: Schema.Number, title: Schema.String, author: Schema.String })

/** The body of a new note. A plain `string` annotation cannot say "not empty"; a referenced Schema can. */
export const NewNote = Schema.Struct({ title: Schema.NonEmptyString })
