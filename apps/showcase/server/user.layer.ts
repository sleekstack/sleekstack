import { RecordNotFound, RecordRejected } from '@sleekstack/model'
import { Effect, Layer, Ref } from 'effect'
import { UserApi } from '../src/modules/users'

type Row = { readonly id: string; readonly name: string }

/** The users table, held by the server process; a name another user has is rejected. */
export default Layer.effect(
  UserApi,
  Effect.map(
    Ref.make<ReadonlyMap<string, Row>>(
      new Map([
        ['u1', { id: 'u1', name: 'Ada Lovelace' }],
        ['u2', { id: 'u2', name: 'Charles Babbage' }],
      ]),
    ),
    (table) => {
      const find = (id: string) =>
        Effect.flatMap(Ref.get(table), (rows) => {
          const row = rows.get(id)
          return row ? Effect.succeed(row) : Effect.fail(new RecordNotFound({ type: 'user', id }))
        })
      return {
        find,
        save: (id, change) =>
          Effect.flatMap(find(id), (row) =>
            Effect.flatMap(Ref.get(table), (rows) => {
              if ([...rows.values()].some((r) => r.id !== id && r.name === change.name))
                return Effect.fail(new RecordRejected({ type: 'user', id, message: `${change.name} is taken` }))
              const saved = { ...row, ...change }
              return Effect.as(Ref.set(table, new Map(rows).set(id, saved)), saved)
            }),
          ),
      }
    },
  ),
)
