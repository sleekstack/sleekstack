import { ResponseStatus } from '@sleekstack/start'
import { Effect, type Schema } from 'effect'
import type { NewNote, Note } from '../../src/schemas'
import { Notes, Viewer } from '../notes'

/** `GET /notes?author=ada`. Each note is encoded through `Note`, so a field outside it is not sent. */
export const GET = (input: {
  readonly query: { readonly author?: string }
}): Effect.Effect<ReadonlyArray<Schema.Schema.Type<typeof Note>>, never, Notes> =>
  Effect.flatMap(Notes, (notes) => notes.list(input.query.author))

/** `POST /notes` with `{ "title": "..." }` answers 201 with the new note. */
export const POST = (input: {
  readonly body: Schema.Schema.Type<typeof NewNote>
}): Effect.Effect<Schema.Schema.Type<typeof Note>, never, Notes | Viewer | ResponseStatus> =>
  Effect.gen(function* () {
    const { name } = yield* Viewer
    const note = yield* (yield* Notes).create(input.body.title, name)
    yield* ResponseStatus.set(201)
    return note
  })
