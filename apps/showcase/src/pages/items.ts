import { Schema } from 'effect'

/** The title is on the list already: the server function's declared error, so it crosses the wire typed. */
export class DuplicateItem extends Schema.TaggedError<DuplicateItem>()('DuplicateItem', { title: Schema.String }) {}

/**
 * The client-safe half of the `items.add` server function: its id and Schemas. The page builds its stub from this and
 * `server/app.ts` builds the function from it, so the browser imports these Schemas and never the server module.
 */
export const addItem = {
  id: 'items.add',
  input: Schema.Struct({ title: Schema.NonEmptyTrimmedString }),
  success: Schema.Array(Schema.String),
  error: DuplicateItem,
}
