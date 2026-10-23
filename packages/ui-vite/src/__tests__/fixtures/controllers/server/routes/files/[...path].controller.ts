import { Effect } from 'effect'

export const GET = (_: { params: { path: string } }) => Effect.succeed('file')
