import type { RpcWrap } from '@sleekstack/start'
import { Effect, type Schema } from 'effect'
import type { Note } from '../src/schemas'
import { Notes, Viewer } from './notes'

/** Every method runs as the viewer named by `x-user`. The Controllers' directory `wrap` never reaches an RPC File. */
export const wrap: RpcWrap = (next, request) =>
  Effect.provideService(next, Viewer, { name: request.headers.get('x-user') ?? 'guest' })

/** The viewer's notes, at the wire id `NotesApi.mine`. */
export const mine = (): Effect.Effect<ReadonlyArray<Schema.Schema.Type<typeof Note>>, never, Notes | Viewer> =>
  Effect.gen(function* () {
    const { name } = yield* Viewer
    return yield* (yield* Notes).list(name)
  })

/** Adds a note as the viewer, at the wire id `NotesApi.add`. */
export const add = (input: {
  readonly title: string
}): Effect.Effect<Schema.Schema.Type<typeof Note>, never, Notes | Viewer> =>
  Effect.gen(function* () {
    const { name } = yield* Viewer
    return yield* (yield* Notes).create(input.title, name)
  })
