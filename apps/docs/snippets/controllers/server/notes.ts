import { Context, Data, Effect, Layer } from 'effect'

type Row = { readonly id: number; readonly title: string; readonly author: string }

export class NoteNotFound extends Data.TaggedError('NoteNotFound')<{ readonly id: number }> {}

/** Who is calling. The directory `wrap` provides it per request. */
export class Viewer extends Context.Tag('Viewer')<Viewer, { readonly name: string }>() {}

export class Notes extends Context.Tag('Notes')<
  Notes,
  {
    readonly list: (author?: string) => Effect.Effect<ReadonlyArray<Row>>
    readonly find: (id: number) => Effect.Effect<Row, NoteNotFound>
    readonly create: (title: string, author: string) => Effect.Effect<Row>
    readonly remove: (id: number) => Effect.Effect<void, NoteNotFound>
  }
>() {}

/** An in-memory store, enough for the guide. */
export const NotesLive = Layer.sync(Notes, () => {
  const rows = new Map<number, Row>()
  let last = 0
  const find = (id: number) => {
    const row = rows.get(id)
    return row ? Effect.succeed(row) : Effect.fail(new NoteNotFound({ id }))
  }
  return {
    list: (author) =>
      Effect.sync(() => [...rows.values()].filter((row) => author === undefined || row.author === author)),
    find,
    create: (title, author) =>
      Effect.sync(() => {
        const row = { id: ++last, title, author }
        rows.set(row.id, row)
        return row
      }),
    remove: (id) => Effect.asVoid(Effect.tap(find(id), () => rows.delete(id))),
  }
})
