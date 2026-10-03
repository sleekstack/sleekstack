/**
 * apps/showcase-kit/src/client/board-family.ts
 *
 * The `board` query, kept free of React so the server page can `prefetch` it. Its fetch is the `readBoard` Server
 * Action; `serializable: true` sends the board DTO to the client as JSON through `<HydrateQueries>`.
 */
import { cachedQuery } from '@sleekstack/kit'
import { readBoard } from '../server/board.actions'
import type { CommentRecord, ProjectRecord, TaskRecord } from '../domain/tags'

export interface BoardProject {
  readonly project: ProjectRecord
  readonly tasks: ReadonlyArray<{ readonly task: TaskRecord; readonly comments: readonly CommentRecord[] }>
}
export type BoardData = readonly BoardProject[]

const boardFamily = cachedQuery({
  key: () => ['board'] as const,
  fetch: function* () {
    return readBoard() as Promise<BoardData>
  },
  serializable: true,
  // the hydrated board is fresh on first paint; mutations invalidate it explicitly
  staleTime: 30_000,
})
/** The one board query (a family of one key). */
export const board = () => boardFamily(undefined)
