import { RecordNotFound, RecordRejected } from '@sleekstack/model'
import { Effect, Layer } from 'effect'
import { ArticleApi } from '../src/article'

type Row = { readonly id: string; readonly title: string; readonly createdAt: string }
declare const db: {
  readonly get: (id: string) => Effect.Effect<Row | undefined>
  readonly setTitle: (id: string, title: string) => Effect.Effect<Row | undefined>
}

// Server-only: the database stays here. A RecordNotFound answers 404, a RecordRejected 422.
export default Layer.succeed(ArticleApi, {
  find: (id) =>
    Effect.flatMap(db.get(id), (row) =>
      row ? Effect.succeed(row) : Effect.fail(new RecordNotFound({ type: 'article', id })),
    ),
  save: (id, change) =>
    change.title.trim() === ''
      ? Effect.fail(new RecordRejected({ type: 'article', id, message: 'A title is required' }))
      : Effect.flatMap(db.setTitle(id, change.title), (row) =>
          row ? Effect.succeed(row) : Effect.fail(new RecordNotFound({ type: 'article', id })),
        ),
})
