import { Effect, type Schema } from 'effect'
import type { Note } from '../../../src/schemas'
import { type NoteNotFound, Notes } from '../../notes'

/** `GET /notes/7`. `id` decodes from the path as a number; `/notes/x` fails the decode, which reaches `wrap`. */
export const GET = (input: {
  readonly params: { readonly id: number }
}): Effect.Effect<Schema.Schema.Type<typeof Note>, NoteNotFound, Notes> =>
  Effect.flatMap(Notes, (notes) => notes.find(input.params.id))

/** `DELETE /notes/7`. A `void` answer is 204. */
export const DELETE = (input: { readonly params: { readonly id: number } }): Effect.Effect<void, NoteNotFound, Notes> =>
  Effect.flatMap(Notes, (notes) => notes.remove(input.params.id))
